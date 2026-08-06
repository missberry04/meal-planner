// Runs on Vercel as a serverless function at /api/generate-plan
// Keeps GROQ_API_KEY on the server — never exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "GROQ_API_KEY is not set. Add it in Vercel Project Settings -> Environment Variables.",
    });
    return;
  }

  const {
    dayNumber,
    totalDays,
    mealsPerDay,
    people,
    budgetPerDay,
    calorieTarget,
    restrictions,
    conditions,
    cuisine,
    previousMealNames,
  } = req.body || {};

  const constraints = [];
  if (budgetPerDay) constraints.push(`Total budget for the day: $${budgetPerDay} for ${people || 1} people.`);
  if (calorieTarget) constraints.push(`Daily calorie target: about ${calorieTarget} kcal total across all meals.`);
  if (restrictions) constraints.push(`Dietary restrictions to respect strictly: ${restrictions}.`);
  if (conditions) {
    constraints.push(
      `The person has these health conditions, so favor suitable choices (e.g. lower sodium for high blood pressure, lower glycemic-load / higher fiber for PCOS or diabetes, lower saturated fat for high cholesterol): ${conditions}.`
    );
  }
  if (cuisine) constraints.push(`Cuisine preference: ${cuisine}.`);
  if (previousMealNames && previousMealNames.length > 0) {
    constraints.push(
      `Do not repeat these meals already used earlier in the week: ${previousMealNames.join(", ")}.`
    );
  }
  constraints.push(`Servings: recipes should serve ${people || 1} people.`);

  const schema = `{
  "day": "Day ${dayNumber}",
  "dayTotalCost": <number, dollars, or null if no budget was given>,
  "dayTotalCalories": <number>,
  "meals": [
    {
      "type": "<Breakfast|Lunch|Dinner|Snack>",
      "name": "<recipe name>",
      "cost": <number dollars or null>,
      "calories": <number>,
      "protein": <grams>,
      "carbs": <grams>,
      "fat": <grams>,
      "prepMinutes": <number>,
      "ingredients": ["<item with quantity>", "..."],
      "instructions": ["<short step>", "..."],
      "fitNotes": "<one short sentence on how this fits the budget/restrictions/conditions given, or omit if none apply>"
    }
  ]
}`;

  const systemPrompt = `You are a practical meal-planning assistant. You write realistic, groceryable recipes with accurate cost and calorie estimates. Keep ingredient lists to 5-9 items and instructions to 3-6 short steps. Respond with ONLY valid JSON matching the schema given, no markdown code fences, no commentary before or after. This is general meal guidance, not medical advice.`;

  const userPrompt = `Generate Day ${dayNumber} of ${totalDays} of a weekly meal plan with ${mealsPerDay || 3} meals for this day.

Constraints:
${constraints.map((c) => `- ${c}`).join("\n")}

Respond with only JSON matching exactly this schema:
${schema}`;

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        max_tokens: 1800,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      res.status(502).json({ error: `Groq API error: ${errText}` });
      return;
    }

    const data = await groqRes.json();
    let text = data.choices?.[0]?.message?.content || "";

    // Strip markdown fences if the model added them anyway
    text = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      res.status(502).json({ error: "Model returned invalid JSON. Try again." });
      return;
    }

    res.status(200).json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message || "Unknown error" });
  }
}
