# Implementation Tasks

This file breaks the dashboard work into ordered tasks derived from [specs/requirements.md](requirements.md) and [specs/design.md](design.md). Each task is limited to the approved scope and references the relevant requirement section.

## 1. Set up the static dashboard shell and project structure

- Create the HTML, CSS, and JavaScript structure for a single-page D3 dashboard.
- Add containers for KPI cards, filter controls, and chart panels.
- Keep the layout aligned with the design: page header, KPI row, and chart grid.
- Requirement references:
  - Requirement 12: Use D3.js, HTML/CSS/JavaScript, and modern browser compatibility
  - Design: Application structure and suggested file-level structure

## 2. Load the CSV dataset and normalize the raw data

- Load the healthcare CSV dataset using D3. from this path(C:\Users\pbhau\Desktop\Project\Re-Ranker\Data\healthcare_pharma.csv)
- Parse and normalize values for dates, numeric fields, booleans, and categorical fields.
- Preserve the original dataset for re-filtering and re-aggregation.
- Requirement references:
  - Requirement 2: Dataset
  - Requirement 12: Data should be loaded from CSV
  - Design: Data loading and data transformation

## 3. Implement centralized filter state and reset behavior

- Define a shared filter state object for department, gender, date range, insurance provider, and time granularity.
- Create the reset action to restore the unfiltered dataset.
- Ensure filter state is the single source of truth for the dashboard.
- Requirement references:
  - Requirement 9: Interactivity
  - Requirement 5: Time analysis
  - Design: Filtering architecture and cross-filtering behavior

## 4. Implement KPI calculations and summary cards

- Calculate the required KPI values from the filtered dataset:
  - Total patients
  - Total admissions
  - Average length of stay
  - Readmission rate
  - Average satisfaction score
  - Total charges
- Render the KPI summary cards and update them whenever filters change.
- Requirement references:
  - Requirement 3: KPI requirements
  - Design: KPI calculations and KPI update rules

## 5. Implement department analysis charts

- Build visualizations for:
  - number of patients by department
  - average length of stay by department
  - average charges by department
- Support department selection so the selected department updates the shared filter state.
- Requirement references:
  - Requirement 4: Department analysis
  - Requirement 9: Department filter
  - Design: Department analysis and cross-filtering behavior

## 6. Implement time analysis chart and time granularity controls

- Display admissions over time using a line or area chart.
- Support the required time selection modes:
  - Month
  - Quarter
  - Year
- Apply the active date range and time granularity to the chart.
- Requirement references:
  - Requirement 5: Time analysis
  - Requirement 9: Date range filter
  - Design: Time analysis and filtering behavior

## 7. Implement diagnosis analysis chart

- Display the top 10 primary diagnoses by patient count.
- Order the chart by patient count and limit results to the top 10.
- Requirement references:
  - Requirement 6: Diagnosis analysis
  - Design: Diagnosis analysis chart

## 8. Implement patient demographics charts

- Render age distribution, gender distribution, and blood type distribution charts.
- Keep the charts aggregated and privacy-safe by excluding private patient identifiers.
- Requirement references:
  - Requirement 7: Patient demographics
  - Requirement 11: Data privacy
  - Design: Patient demographics and privacy-safe transformation rules

## 9. Implement financial analysis charts

- Display total charges by department.
- Show insurance coverage percentage.
- Show payment status distribution.
- Requirement references:
  - Requirement 8: Financial analysis
  - Requirement 9: Insurance provider filter and filter-driven updates
  - Design: Financial analysis

## 10. Add responsive layout and D3 resizing behavior

- Ensure the dashboard layout and charts adapt to browser resize.
- Use SVG viewBox or equivalent responsive sizing approach.
- Maintain readable spacing and axes at smaller widths.
- Requirement references:
  - Requirement 12: Dashboard must work in a modern browser
  - Requirement 12: Charts should be responsive
  - Design: Responsive behavior

## 11. Add tooltip behavior for all chart elements

- Show hover tooltips with relevant aggregate values.
- Include category, count, average, value, and time label where relevant.
- Do not display patient_name, mrn, or exact date_of_birth.
- Requirement references:
  - Requirement 10: Tooltip behavior
  - Requirement 11: Data privacy
  - Design: Tooltip behavior and privacy-safe rules

## 12. Add error and empty-state handling

- Display a clear message if the CSV fails to load.
- Show empty states when filters remove all records.
- Prevent crashes when values are missing or malformed.
- Requirement references:
  - Requirement 12: Dashboard must work in a modern browser
  - Design: Error handling

## 13. Validate dashboard consistency across all filters

- Confirm that all KPI cards and charts recompute from the same filtered dataset.
- Ensure all filter changes update every relevant visualization.
- Verify that selected department, gender, insurance provider, and date range all influence the dashboard consistently.
- Requirement references:
  - Requirement 9: Interactivity
  - Design: Cross-filtering behavior

## 14. Final review against requirements

- Verify every required KPI, chart, filter, and privacy rule is present.
- Confirm there are no unsupported features, no patient-identifying data, and no React usage.
- Requirement references:
  - Requirement 1: Objective
  - Requirement 9: Interactivity
  - Requirement 11: Data privacy
  - Requirement 12: Technical requirements

## 15. Deploy the dashboard with Streamlit Community Cloud

- Add a Python Streamlit entry point named `app.py` that hosts the existing single-page D3 dashboard without replacing its HTML/CSS/JavaScript or D3 chart implementation.
- Add and declare the Python dependencies required by the Streamlit host.
- Include the dashboard page, styles, scripts, D3 dependency, and approved CSV source in the deployment repository.
- Configure deployment-safe asset and CSV URLs or paths; remove reliance on machine-specific absolute paths.
- Ensure only synthetic or de-identified records are included in browser-delivered deployment data. Do not publish patient names, MRNs, or exact dates of birth.
- Deploy to Streamlit Community Cloud and verify that the deployed dashboard can load its assets and data and that the required filters, reset, KPIs, charts, tooltips, responsive behavior, and error/empty states work.
- Requirement references:
  - Requirement 13: Deployment requirements
  - Requirement 11: Data privacy
  - Design: Deployment architecture
