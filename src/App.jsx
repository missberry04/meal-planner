import React, { useState } from "react";
import {
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
  Plus,
  AlertCircle,
} from "lucide-react";

const RESTRICTIONS = [
  "Vegetarian",
  "Vegan",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Dairy-free",
  "Nut-free",
  "Shellfish-free",
  "Low-carb",
  "Keto",
  "Pescatarian",
  "Soy-free",
  "Egg-free",
];

const CONDITIONS = [
  "PCOS",
  "High blood pressure",
  "Type 2 diabetes",
  "High cholesterol",
  "Celiac disease",
  "IBS",
  "GERD / acid reflux",
  "Hypothyroidism",
  "Heart disease",
  "Kidney disease",
  "Anemia",
];

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary (little to no exercise)", mult: 1.2 },
  { value: "light", label: "Light exercise 1-3 days/week", mult: 1.375 },
  { value: "moderate", label: "Moderate exercise 3-5 days/week", mult: 1.55 },
  { value: "active", label: "Active 6-7 days/week", mult: 1.725 },
  { value: "very_active", label: "Very active / physical job", mult: 1.9 },
];

function calcCalorieTarget(f) {
  const w = parseFloat(f.weightLbs);
  const ft = parseFloat(f.heightFt);
  const inch = parseFloat(f.heightIn) || 0;
  const age = parseFloat(f.age);
  if (!w || !ft || !age || !f.sex || !f.activity) return null;

  const weightKg = w * 0.453592;
  const heightCm = (ft * 12 + inch) * 2.54;
  let bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (f.sex === "male" ? 5 : -161);

  const activity = ACTIVITY_LEVELS.find((a) => a.value === f.activity);
  let tdee = bmr * (activity ? activity.mult : 1.2);

  if (f.goal === "lose") tdee -= 500;
  if (f.goal === "gain") tdee += 500;

  tdee = Math.max(1200, Math.round(tdee));
  return tdee;
}

function toggleInArray(arr, value) {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

const initialForm = {
  days: 3,
  mealsPerDay: 3,
  people: 1,
  useBudget: false,
  budgetPerDay: "",
  weightLbs: "",
  heightFt: "",
  heightIn: "",
  age: "",
  sex: "",
  activity: "",
  goal: "maintain",
  useCalorieOverride: false,
  calorieOverride: "",
  restrictions: [],
  restrictionOther: "",
  conditions: [],
  conditionOther: "",
  cuisine: "",
};

export default function App() {
  const [form, setForm] = useState(initialForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [days, setDays] = useState([]); // generated day plans
  const [dayErrors, setDayErrors] = useState({});
  const [generating, setGenerating] = useState(false);
  const [currentDay, setCurrentDay] = useState(0);
  const [activeTab, setActiveTab] = useState(0);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const calorieTarget = form.useCalorieOverride
    ? parseFloat(form.calorieOverride) || null
    : calcCalorieTarget(form);

  async function requestDay(dayIndex, previousMealNames) {
    const payload = {
      dayNumber: dayIndex + 1,
      totalDays: parseInt(form.days, 10),
      mealsPerDay: parseInt(form.mealsPerDay, 10),
      people: parseInt(form.people, 10) || 1,
      budgetPerDay: form.useBudget ? parseFloat(form.budgetPerDay) || null : null,
      calorieTarget: calorieTarget || null,
      restrictions: [...form.restrictions, form.restrictionOther]
        .filter(Boolean)
        .join(", "),
      conditions: [...form.conditions, form.conditionOther]
        .filter(Boolean)
        .join(", "),
      cuisine: form.cuisine || null,
      previousMealNames,
    };

    const res = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed (${res.status})`);
    }
    return res.json();
  }

  async function generatePlan() {
    setGenerating(true);
    setDays([]);
    setDayErrors({});
    setActiveTab(0);

    const totalDays = parseInt(form.days, 10) || 1;
    const collected = [];
    const previousMealNames = [];

    for (let i = 0; i < totalDays; i++) {
      setCurrentDay(i + 1);
      try {
        const dayPlan = await requestDay(i, previousMealNames);
        collected.push(dayPlan);
        (dayPlan.meals || []).forEach((m) => previousMealNames.push(m.name));
        setDays([...collected]);
      } catch (err) {
        setDayErrors((prev) => ({ ...prev, [i]: err.message }));
        collected.push(null);
        setDays([...collected]);
      }
    }
    setGenerating(false);
  }

  async function retryDay(i) {
    setDayErrors((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
    const previousMealNames = days
      .filter(Boolean)
      .flatMap((d) => (d.meals || []).map((m) => m.name));
    try {
      const dayPlan = await requestDay(i, previousMealNames);
      setDays((prev) => {
        const next = [...prev];
        next[i] = dayPlan;
        return next;
      });
    } catch (err) {
      setDayErrors((prev) => ({ ...prev, [i]: err.message }));
    }
  }

  const weeklyCost = days
    .filter(Boolean)
    .reduce((sum, d) => sum + (d.dayTotalCost || 0), 0);

  return (
    <div className="app">
      <header className="hero">
        <p className="eyebrow">Weekly Meal Plan</p>
        <h1>Feed the week, on your terms.</h1>
        <p className="sub">
          Set a budget, calorie goal, restrictions, or a medical condition —
          fill in only what matters to you. Everything else stays flexible.
        </p>
      </header>

      <section className="card form-card">
        <div className="grid">
          <label className="field">
            <span>Days</span>
            <input
              type="number"
              min="1"
              max="7"
              value={form.days}
              onChange={(e) => update("days", e.target.value)}
            />
          </label>
          <label className="field">
            <span>Meals per day</span>
            <input
              type="number"
              min="1"
              max="6"
              value={form.mealsPerDay}
              onChange={(e) => update("mealsPerDay", e.target.value)}
            />
          </label>
          <label className="field">
            <span>People / servings</span>
            <input
              type="number"
              min="1"
              max="12"
              value={form.people}
              onChange={(e) => update("people", e.target.value)}
            />
          </label>
        </div>

        <div className="field-row toggle-row">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.useBudget}
              onChange={(e) => update("useBudget", e.target.checked)}
            />
            <span>Set a daily budget</span>
          </label>
          {form.useBudget && (
            <label className="field inline">
              <span>$ per day</span>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="20"
                value={form.budgetPerDay}
                onChange={(e) => update("budgetPerDay", e.target.value)}
              />
            </label>
          )}
        </div>

        <button
          type="button"
          className="link-btn"
          onClick={() => setShowAdvanced((s) => !s)}
        >
          {showAdvanced ? "Hide" : "Add"} weight/height, goals & health details{" "}
          <ChevronRight
            size={16}
            style={{
              transform: showAdvanced ? "rotate(90deg)" : "none",
              transition: "transform 0.15s",
            }}
          />
        </button>

        {showAdvanced && (
          <div className="advanced">
            <p className="section-label">
              Calorie target (optional — used to estimate a daily calorie goal)
            </p>
            <div className="field-row toggle-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.useCalorieOverride}
                  onChange={(e) => update("useCalorieOverride", e.target.checked)}
                />
                <span>I'll set my own calorie target</span>
              </label>
              {form.useCalorieOverride && (
                <label className="field inline">
                  <span>Calories/day</span>
                  <input
                    type="number"
                    min="800"
                    value={form.calorieOverride}
                    onChange={(e) => update("calorieOverride", e.target.value)}
                  />
                </label>
              )}
            </div>

            {!form.useCalorieOverride && (
              <div className="grid">
                <label className="field">
                  <span>Weight (lbs)</span>
                  <input
                    type="number"
                    value={form.weightLbs}
                    onChange={(e) => update("weightLbs", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Height (ft)</span>
                  <input
                    type="number"
                    value={form.heightFt}
                    onChange={(e) => update("heightFt", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Height (in)</span>
                  <input
                    type="number"
                    value={form.heightIn}
                    onChange={(e) => update("heightIn", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Age</span>
                  <input
                    type="number"
                    value={form.age}
                    onChange={(e) => update("age", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Sex</span>
                  <select
                    value={form.sex}
                    onChange={(e) => update("sex", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </label>
                <label className="field">
                  <span>Activity level</span>
                  <select
                    value={form.activity}
                    onChange={(e) => update("activity", e.target.value)}
                  >
                    <option value="">—</option>
                    {ACTIVITY_LEVELS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Goal</span>
                  <select
                    value={form.goal}
                    onChange={(e) => update("goal", e.target.value)}
                  >
                    <option value="lose">Lose weight</option>
                    <option value="maintain">Maintain</option>
                    <option value="gain">Gain weight</option>
                  </select>
                </label>
              </div>
            )}

            {calorieTarget && (
              <p className="calc-note">
                Estimated target: <strong>{calorieTarget} kcal/day</strong>
              </p>
            )}

            <p className="section-label">Dietary restrictions</p>
            <div className="chips">
              {RESTRICTIONS.map((r) => (
                <button
                  type="button"
                  key={r}
                  className={`chip ${form.restrictions.includes(r) ? "active" : ""}`}
                  onClick={() =>
                    update("restrictions", toggleInArray(form.restrictions, r))
                  }
                >
                  {r}
                </button>
              ))}
            </div>
            <input
              className="text-input"
              placeholder="Other restriction (optional)"
              value={form.restrictionOther}
              onChange={(e) => update("restrictionOther", e.target.value)}
            />

            <p className="section-label">Medical conditions</p>
            <div className="chips">
              {CONDITIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip health ${
                    form.conditions.includes(c) ? "active" : ""
                  }`}
                  onClick={() =>
                    update("conditions", toggleInArray(form.conditions, c))
                  }
                >
                  {c}
                </button>
              ))}
            </div>
            <input
              className="text-input"
              placeholder="Other condition (optional)"
              value={form.conditionOther}
              onChange={(e) => update("conditionOther", e.target.value)}
            />
            <p className="disclaimer">
              <AlertCircle size={14} />
              This isn't medical advice. It's general meal guidance — check
              with your doctor or a dietitian for anything condition-specific.
            </p>

            <p className="section-label">Cuisine preference (optional)</p>
            <input
              className="text-input"
              placeholder="e.g. South Asian, Mediterranean, no preference"
              value={form.cuisine}
              onChange={(e) => update("cuisine", e.target.value)}
            />
          </div>
        )}

        <button
          type="button"
          className="generate-btn"
          onClick={generatePlan}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 className="spin" size={18} /> Generating day {currentDay}{" "}
              of {form.days}...
            </>
          ) : (
            "Generate my meal plan"
          )}
        </button>
      </section>

      {days.length > 0 && (
        <section className="results">
          <div className="tabs">
            {days.map((_, i) => (
              <button
                key={i}
                className={`tab ${activeTab === i ? "active" : ""}`}
                onClick={() => setActiveTab(i)}
              >
                Day {i + 1}
              </button>
            ))}
          </div>

          {weeklyCost > 0 && (
            <p className="weekly-total">
              Running total so far: <strong>${weeklyCost.toFixed(2)}</strong>
            </p>
          )}

          <div className="day-panel">
            {dayErrors[activeTab] ? (
              <div className="error-box">
                <AlertCircle size={18} />
                <p>Couldn't generate Day {activeTab + 1}: {dayErrors[activeTab]}</p>
                <button onClick={() => retryDay(activeTab)} className="retry-btn">
                  <RefreshCw size={14} /> Retry
                </button>
              </div>
            ) : !days[activeTab] ? (
              <div className="error-box">
                <Loader2 className="spin" size={18} />
                <p>Waiting on this day...</p>
              </div>
            ) : (
              <>
                <div className="day-summary">
                  <span>{days[activeTab].dayTotalCalories || "—"} kcal</span>
                  {days[activeTab].dayTotalCost ? (
                    <span>${days[activeTab].dayTotalCost.toFixed(2)}</span>
                  ) : null}
                </div>
                <div className="meals">
                  {(days[activeTab].meals || []).map((meal, mi) => (
                    <article className="meal-card" key={mi}>
                      <div className="meal-tab">{meal.type}</div>
                      <h3>{meal.name}</h3>
                      <div className="meal-meta">
                        {meal.calories ? <span>{meal.calories} kcal</span> : null}
                        {meal.cost ? <span>${meal.cost.toFixed(2)}</span> : null}
                        {meal.prepMinutes ? (
                          <span>{meal.prepMinutes} min</span>
                        ) : null}
                      </div>
                      {(meal.protein || meal.carbs || meal.fat) && (
                        <div className="macros">
                          {meal.protein ? <span>P {meal.protein}g</span> : null}
                          {meal.carbs ? <span>C {meal.carbs}g</span> : null}
                          {meal.fat ? <span>F {meal.fat}g</span> : null}
                        </div>
                      )}
                      {meal.ingredients && (
                        <>
                          <p className="label">Ingredients</p>
                          <ul>
                            {meal.ingredients.map((ing, ii) => (
                              <li key={ii}>{ing}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {meal.instructions && (
                        <>
                          <p className="label">Instructions</p>
                          <ol>
                            {meal.instructions.map((step, si) => (
                              <li key={si}>{step}</li>
                            ))}
                          </ol>
                        </>
                      )}
                      {meal.fitNotes && (
                        <p className="fit-note">{meal.fitNotes}</p>
                      )}
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
