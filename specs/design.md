# Patient Analytics Dashboard Design

## 1. Scope

This document defines the D3.js dashboard architecture implied by [specs/requirements.md](requirements.md). It stays strictly within the stated requirements and does not introduce additional dashboard features, controls, or data elements beyond what is explicitly required.

## 2. Design principles

- Use D3.js for all chart rendering and interaction.
- Use HTML, CSS, and JavaScript only.
- Keep the dashboard in a single-page browser view with filter controls and summary cards.
- Load the CSV dataset once and derive all required views from a common filtered dataset.
- Never expose protected patient identifiers or exact birth dates in aggregate visualizations.
- Ensure all charts update from the same filter state so the dashboard remains consistent.

## 3. Application structure

The dashboard should be organized into four primary parts:

1. Layout shell
   - Page header with dashboard title and filter controls.
   - KPI summary row at the top.
   - Main chart grid below the KPI row.

2. Filter state layer
   - Holds the current selected filters:
     - department
     - gender
     - date range
     - insurance provider
   - Provides a reset action for restoring the base dataset.

3. Data processing layer
   - Loads the CSV.
   - Converts raw values to consistent types.
   - Produces filtered and aggregated data used for every chart.

4. Visualization layer
   - D3-based charts for KPI summaries and analytical views.
   - Re-renders from the shared filtered dataset when filters change.

### Suggested file-level structure

- `index.html`
  - Dashboard layout containers, KPI section, filter controls, chart containers.
- `styles.css`
  - Layout, sizing, spacing, responsive behavior, and chart styling.
- `app.js`
  - Application bootstrap, filter state orchestration, and chart rendering pipeline.
- `data.js`
  - CSV loading and raw data normalization.
- `transform.js`
  - Filtering and aggregation logic for KPIs and chart data.
- `charts.js`
  - D3 chart definitions and tooltip behavior.

This structure is a design suggestion only; the implementation should remain minimal and driven by the requirements.

## 4. Data loading

### 4.1 Source

- Load the healthcare CSV dataset from a local file path or static asset as required by the browser environment.
- Use D3’s CSV parser for data ingestion.

### 4.2 Required dataset fields

The dashboard must support all fields listed in the requirements, including:

- patient identifiers and demographics
- admission and discharge metadata
- department and diagnosis fields
- operational/financial metrics
- satisfaction and payment status fields

### 4.3 Loading behavior

- Parse the CSV once at startup.
- Normalize numeric fields before visualization.
- Keep the original record set intact for filtering and reaggregation.
- Maintain one canonical in-memory dataset for all downstream computations.

### 4.4 Data integrity handling

- If CSV parsing fails, show a clear empty-state or error message while preserving the layout.
- If required fields are missing or malformed, skip or flag the affected records without altering the rest of the dashboard.
- Do not display protected fields in any aggregate visualization.

## 5. Data transformation

The dashboard should derive all required analytic views from the raw CSV using consistent transformations.

### 5.1 Core transformations

- Convert date strings to JavaScript date objects for time filtering and grouping.
- Convert numeric values such as age, length of stay, charges, and scores to numbers.
- Convert boolean-like fields such as readmission_30days and payment status indicators into discrete values used for grouping or KPI logic.
- Normalize department, gender, insurance provider, blood type, and diagnosis values for grouping.

### 5.2 Derived views required by the requirements

- Department-level summaries:
  - number of patients by department
  - average length of stay by department
  - average charges by department
- Time-level summaries:
  - admissions by month, quarter, or year depending on selected time granularity
- Diagnosis summaries:
  - top 10 primary diagnoses by patient count
- Demographic summaries:
  - age distribution
  - gender distribution
  - blood type distribution
- Financial summaries:
  - total charges by department
  - insurance coverage percentage
  - payment status distribution

### 5.3 Privacy-safe transformation rules

The following fields must not be used in aggregate dashboards:

- patient_name
- mrn
- exact date_of_birth

These fields should be excluded from all aggregated chart data and tooltip content.

## 6. Filtering architecture

The dashboard must support filters for:

- department
- gender
- date range
- insurance provider
- reset filters

### 6.1 Filter state model

Use one shared filter state object so all charts render from the same data subset. Example conceptually:

- department: selected value or all
- gender: selected value or all
- startDate / endDate: current date range
- insuranceProvider: selected value or all
- timeGranularity: month, quarter, or year

### 6.2 Filter application rules

- Apply all active filters to the base dataset before calculating any KPI or chart metric.
- Every chart must use the same filtered dataset, ensuring the dashboard remains synchronized.
- Reset must restore the full dataset and clear all current selections.

### 6.3 Date filter behavior

- The dashboard must support a date range filter.
- The time analysis chart must respect the selected date range and the selected time breakdown.
- The time breakdown selection is limited to:
  - month
  - quarter
  - year

### 6.4 Department selection behavior

- Department selection is required.
- Selecting a department should apply the filter to all affected charts.
- The department selections should also be reflected in KPI totals, time analysis, diagnosis analysis, and financial views because all charts depend on the same filtered state.

## 7. KPI calculations

The dashboard must display the following KPIs on the filtered dataset:

- Total patients
- Total admissions
- Average length of stay
- Readmission rate
- Average satisfaction score
- Total charges

### 7.1 KPI formulas

- Total patients
  - Count of unique patient_id records in the filtered dataset.
- Total admissions
  - Count of records in the filtered dataset.
- Average length of stay
  - Mean of length_of_stay_days across the filtered dataset.
- Readmission rate
  - Percentage of admissions in the filtered dataset where readmission_30days is true or equivalent positive value.
- Average satisfaction score
  - Mean of satisfaction_score across the filtered dataset.
- Total charges
  - Sum of total_charges_eur across the filtered dataset.

### 7.2 KPI update rules

All KPI cards must recompute whenever the user changes any filter. They should remain consistent with the currently selected department, gender, insurance provider, and date range.

## 8. Chart types

The chart types below are required by the requirements and should be implemented in D3 as standard SVG-based views.

### 8.1 KPI cards

- Separate card for each KPI metric.
- Use simple numeric formatting.
- No drill-down beyond the current filter state.

### 8.2 Department analysis

- Bar chart for number of patients by department.
- Bar chart for average length of stay by department.
- Bar chart for average charges by department.
- Department selection should be supported by clicking or selecting a department bar.

### 8.3 Time analysis

- Line or area chart showing admissions over time.
- Time aggregation controlled by selected granularity:
  - month
  - quarter
  - year

### 8.4 Diagnosis analysis

- Horizontal or vertical bar chart showing top 10 primary diagnoses by patient count.
- Limit to the top 10 categories.

### 8.5 Patient demographics

- Age distribution chart.
- Gender distribution chart.
- Blood type distribution chart.

These should be grouped or distribution charts using D3 scales and axes, without exposing private identifiers.

### 8.6 Financial analysis

- Bar chart for total charges by department.
- Summary statistic or chart for insurance coverage percentage.
- Chart for payment status distribution.

## 9. Cross-filtering behavior

The requirement states that all charts must update when filters change. The architecture should therefore follow a single-source-of-truth pattern:

- Filters update a central state object.
- The current filtered dataset is recomputed from the base CSV.
- Every KPI and chart is derived from that same filtered dataset.

### 9.1 Selection-driven update pattern

- Department filters can be driven by department chart selections.
- Gender filters can be driven by demographic chart selection if a user chooses a category.
- Insurance provider filters can be driven by financial or demographic selection where the filter is relevant.
- Date range and granularity choices update the time series and the global filtered dataset.

### 9.2 Rule for consistency

No chart should calculate independently from a stale local subset. All chart data must come from the latest filtered dataset produced by the dashboard state model.

## 10. Responsive behavior

The dashboard must work in a modern browser and be responsive.

### 10.1 Layout behavior

- Use flexible grid containers for KPI cards and chart panels.
- Allow chart panels to resize with browser width.
- Maintain readable labels and spacing across common desktop widths.

### 10.2 D3 behavior

- Use SVG with viewBox support so charts scale cleanly as containers resize.
- Recompute axes, scales, and layout on resize.
- Avoid fixed pixel dimensions that prevent responsiveness.

## 11. Tooltip behavior

Hovering over a chart element must display relevant information about that element.

### 11.1 Tooltip content

Tooltips should be chart-specific and include only safe aggregate information such as:

- category name
- count or value
- percentage or average, when relevant
- time bucket label when relevant

### 11.2 Protected data rules

Tooltips must not display:

- patient_name
- mrn
- exact date_of_birth

### 11.3 Tooltip mechanics

- Use a lightweight HTML tooltip positioned near the cursor.
- Show it on hover and hide it on mouse leave.
- Ensure the tooltip content reflects the hovered aggregate element and the current filter state.

## 12. Error handling

The dashboard should fail gracefully when input or data conditions do not meet expectations.

### 12.1 CSV loading errors

- If the CSV cannot be loaded, display a user-facing error message in the dashboard area instead of a blank page.
- Keep filter controls visible so the user knows the dashboard is waiting for data.

### 12.2 Empty and filtered-out states

- If filters produce no remaining records, show a safe empty state for charts and KPI cards.
- Do not crash or leave partially rendered chart containers in an invalid state.

### 12.3 Partial data issues

- For malformed rows or missing values, skip the unusable values without disrupting the rest of the dashboard.
- Ensure chart rendering remains stable even if one category or one date field is missing.

### 12.4 Privacy enforcement

- Any visualization that would include protected fields should be blocked from rendering.
- The dashboard must only surface aggregate-level values that are explicitly permitted by the requirements.

## 13. Implementation constraints

This architecture intentionally avoids features beyond the stated requirements:

- No React usage.
- No additional dashboard pages.
- No unsupported filters or chart types.
- No export or drill-down features not described in the requirements.
- No patient-level row display.

The dashboard should remain a single-page, browser-based D3 analytics view focused strictly on the required metrics, filters, and aggregate visualizations.

## 14. Deployment architecture

### 14.1 Streamlit host

- Deploy the dashboard through Streamlit Community Cloud using a Python entry point named `app.py`.
- Keep Streamlit as the host and deployment wrapper only. The existing single-page dashboard remains HTML/CSS/JavaScript, and D3.js remains responsible for all chart rendering and interactions.
- The Streamlit entry point should load the dashboard page and mount it in the Streamlit app using a supported HTML-component approach. It must not reimplement the dashboard charts with Streamlit widgets or another charting library.

### 14.2 Deployed assets and data

- Keep the entry point, Python dependencies, dashboard HTML/CSS/JavaScript, D3 dependency, and approved CSV source in the deployment repository.
- Resolve dashboard assets and the CSV using deployment-safe paths or URLs, not developer-machine absolute paths.
- Ensure the embedded dashboard can resolve its CSS, JavaScript, and CSV at runtime in the Streamlit deployment environment. Relative paths must be resolved against a valid deployed asset location rather than assumed to be relative to the repository root.
- Load the CSV once in the browser dashboard and continue using its existing normalization, shared filter state, and rendering pipeline.

### 14.3 Privacy boundary

- Only synthetic or de-identified data may be placed in browser-delivered deployment assets.
- Because the browser must fetch the CSV, treat every included CSV field as accessible to dashboard visitors. Do not include patient names, MRNs, or exact dates of birth in that deployed CSV; hiding these fields from charts alone is not sufficient protection.
- Keep protected fields out of aggregate chart data, rendered text, and tooltip content as already specified.

### 14.4 Deployment verification

Before deployment is considered complete, verify the published Streamlit app can load its assets and CSV and that the dashboard renders successfully in a modern browser. Verify the required filters and reset behavior, KPIs, charts, tooltips, responsive resizing, and CSV-load and no-data empty states on the deployed app.

The dashboard should remain a single-page, browser-based D3 analytics view focused strictly on the required metrics, filters, and aggregate visualizations.
