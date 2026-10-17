/** Plain-language descriptions of the 13 clinical inputs, risk bands and generic guidance. */

export type RiskLevel = 'low' | 'moderate' | 'high';

export const LOW_RISK_BELOW = 20;
export const HIGH_RISK_FROM = 50;

export function riskLevel(percent: number): RiskLevel {
  return percent < LOW_RISK_BELOW ? 'low' : percent < HIGH_RISK_FROM ? 'moderate' : 'high';
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  low: 'Low risk',
  moderate: 'Moderate risk',
  high: 'High risk'
};

export const FEATURE_NAMES: Record<string, string> = {
  age: 'Age',
  sex: 'Sex',
  cp: 'Chest pain type',
  trtbps: 'Resting blood pressure',
  chol: 'Cholesterol',
  fbs: 'Fasting blood sugar',
  restecg: 'Resting ECG',
  thalachh: 'Maximum heart rate',
  exng: 'Exercise-induced chest pain',
  oldpeak: 'ST depression',
  slp: 'ST segment slope',
  caa: 'Blocked major vessels',
  thall: 'Thalassemia result'
};

const UNITS: Record<string, string> = { age: ' years', trtbps: ' mm Hg', chol: ' mg/dl', thalachh: ' bpm' };

const VALUE_LABELS: Record<string, Record<string, string>> = {
  sex: { '1': 'Male', '0': 'Female' },
  cp: { '0': 'No chest pain (asymptomatic)', '1': 'Atypical angina', '2': 'Non-anginal pain', '3': 'Typical angina' },
  fbs: { '1': 'Above 120 mg/dl', '0': '120 mg/dl or lower' },
  restecg: { '0': 'Left ventricular hypertrophy', '1': 'Normal', '2': 'ST-T wave abnormality' },
  exng: { '1': 'Yes', '0': 'No' },
  slp: { '0': 'Downsloping', '1': 'Flat', '2': 'Upsloping' },
  caa: { '0': '0 vessels', '1': '1 vessel', '2': '2 vessels', '3': '3 vessels', '4': '4 vessels' },
  thall: { '1': 'Fixed defect', '2': 'Normal', '3': 'Reversible defect' }
};

/** e.g. formatInput('trtbps', 150) -> "150 mm Hg", formatInput('sex', 1) -> "Male" */
export function formatInput(key: string, value: number | string): string {
  const labels = VALUE_LABELS[key];
  if (labels) return labels[String(value)] ?? String(value);
  return `${value}${UNITS[key] ?? ''}`;
}

export interface Advice {
  icon: string;
  tone: 'red' | 'amber' | 'green' | 'blue';
  text: string;
}

/**
 * Generic, conservative guidance derived from the entered values. It is NOT medical advice -
 * every list ends with a pointer to a doctor.
 */
export function adviceFor(inputs: Record<string, number | string>, level: RiskLevel): Advice[] {
  const n = (key: string) => Number(inputs[key]);
  const tips: Advice[] = [];

  if (level === 'high') {
    tips.push({
      icon: 'bi-hospital', tone: 'red',
      text: 'Your estimated risk is high. Please book an appointment with a doctor or cardiologist for a proper evaluation. ' +
            'If you ever have chest pain, shortness of breath or pain spreading to the arm or jaw, seek emergency care immediately.'
    });
  }

  if (n('trtbps') >= 140) {
    tips.push({ icon: 'bi-activity', tone: 'red', text: `Your resting blood pressure (${n('trtbps')} mm Hg) is in the range usually considered high (140 or above). Have it checked regularly and discuss it with your doctor.` });
  } else if (n('trtbps') >= 120) {
    tips.push({ icon: 'bi-activity', tone: 'amber', text: `Your resting blood pressure (${n('trtbps')} mm Hg) is slightly above the ideal level of about 120. Less salt, regular exercise and a healthy weight help.` });
  }

  if (n('chol') >= 240) {
    tips.push({ icon: 'bi-droplet-half', tone: 'red', text: `A cholesterol level of ${n('chol')} mg/dl is considered high (240 or above). Diet, exercise and, where needed, medication can lower it - speak to your doctor.` });
  } else if (n('chol') >= 200) {
    tips.push({ icon: 'bi-droplet-half', tone: 'amber', text: `A cholesterol level of ${n('chol')} mg/dl is borderline (200 - 239). Reducing saturated fat and eating more fibre can help.` });
  }

  if (n('fbs') === 1) {
    tips.push({ icon: 'bi-cup-straw', tone: 'amber', text: 'A fasting blood sugar above 120 mg/dl can point to pre-diabetes or diabetes. Consider a blood-sugar test (HbA1c).' });
  }

  if (n('exng') === 1) {
    tips.push({ icon: 'bi-person-walking', tone: 'red', text: 'You get chest pain during exercise. This deserves a medical check-up - please do not ignore it.' });
  }

  if (n('caa') >= 1) {
    tips.push({ icon: 'bi-diagram-2', tone: 'red', text: `${n('caa')} narrowed or blocked major vessel(s) were reported. Follow the treatment plan agreed with your cardiologist.` });
  }

  if (n('oldpeak') >= 2) {
    tips.push({ icon: 'bi-graph-up', tone: 'amber', text: `An ST depression of ${n('oldpeak')} on your exercise ECG is a notable finding worth reviewing with your doctor.` });
  }

  const expectedMax = 220 - n('age');
  if (n('thalachh') > 0 && n('thalachh') < 0.7 * expectedMax) {
    tips.push({ icon: 'bi-heart-pulse', tone: 'amber', text: `Your maximum heart rate (${n('thalachh')} bpm) is well below the roughly ${expectedMax} bpm expected for your age. Mention this to your doctor.` });
  }

  if (tips.length === 0 || level === 'low') {
    tips.push({ icon: 'bi-emoji-smile', tone: 'green', text: 'Keep up the healthy habits: regular physical activity, a balanced diet, no smoking, enough sleep and regular check-ups.' });
  }

  return tips;
}
