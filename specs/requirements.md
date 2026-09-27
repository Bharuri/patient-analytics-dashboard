# Patient Analytics Dashboard Requirements

## 1. Objective

Build an interactive healthcare analytics dashboard using D3.js.

The dashboard must allow users to explore patient admissions,
departments, diagnoses, length of stay, readmissions,
charges, and satisfaction.

## 2. Dataset

The dashboard uses a CSV dataset containing:

- patient_id
- mrn
- patient_name
- date_of_birth
- age
- gender
- blood_type
- city
- insurance_provider
- admission_date
- discharge_date
- department
- primary_diagnosis
- secondary_diagnosis
- attending_physician
- medications_prescribed
- vital_signs_bp_systolic
- vital_signs_bp_diastolic
- vital_signs_heart_rate
- vital_signs_temperature
- lab_result_glucose
- lab_result_hemoglobin
- length_of_stay_days
- readmission_30days
- discharge_status
- total_charges_eur
- insurance_coverage_pct
- payment_status
- satisfaction_score
- created_at

## 3. KPI requirements

The dashboard must display:

- Total patients
- Total admissions
- Average length of stay
- Readmission rate
- Average satisfaction score
- Total charges

## 4. Department analysis

Display:

- Number of patients by department
- Average length of stay by department
- Average charges by department

Users must be able to select a department.

## 5. Time analysis

Display admissions over time.

Users must be able to select:

- Month
- Quarter
- Year

## 6. Diagnosis analysis

Display the top 10 primary diagnoses by patient count.

## 7. Patient demographics

Display:

- Age distribution
- Gender distribution
- Blood type distribution

## 8. Financial analysis

Display:

- Total charges by department
- Insurance coverage percentage
- Payment status distribution

## 9. Interactivity

The dashboard must support:

- Department filter
- Gender filter
- Date range filter
- Insurance provider filter
- Reset filters button

All charts must update when filters change.

## 10. Tooltip behavior

Hovering over a chart element must display relevant
information about that element.

## 11. Data privacy

The dashboard must not display:

- patient_name
- mrn
- exact date_of_birth

in aggregate dashboard visualizations.

## 12. Technical requirements

- Use D3.js for visualization.
- Use HTML/CSS/JavaScript.
- No React.
- Dashboard must work in a modern browser.
- Data should be loaded from CSV.
- Charts should be responsive.

## 13. Deployment requirements
Deploy the dashboard on Streamlit Community Cloud.
Add a Python Streamlit entry point named app.py to host the dashboard. Streamlit is the host; retain D3.js for charts and HTML/CSS/JavaScript for the dashboard.
Include the entry point, its Python dependencies, and all required dashboard assets in the deployment repository.
Load assets and CSV data using paths or URLs that work in the deployed environment; do not rely on machine-specific absolute paths.
Use only synthetic or de-identified data in files delivered to the browser. Do not publish patient names, MRNs, or exact dates of birth.
Before considering deployment complete, verify that the published dashboard loads its data and that the required filters, reset action, KPIs, charts, tooltips, responsive layout, and error and empty states work.