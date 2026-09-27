# Streamlit Community Cloud deployment

The Streamlit app hosts the existing D3 dashboard. D3, HTML, CSS, and JavaScript continue to render the dashboard; Streamlit only hosts the page.

## Prepare the browser-delivered dataset

The source CSV contains direct identifiers and must not be committed or served to browser clients. Prepare a separate deployment copy locally:

1. Confirm that the source data is approved for deployment and is synthetic or de-identified. The preparation script removes direct identifiers, replaces source patient IDs with generated IDs, clears city, attending physician, and creation timestamp, and caps ages at 90.
2. Run `python scripts/prepare_deployment_data.py` in the project environment.
3. Review `static/healthcare_pharma.csv`. Commit this sanitized output only after confirming it contains no identifying data. Do not remove the ignore rule for `Data/healthcare_pharma.csv` or commit that source file.

The script preserves the dashboard's required CSV columns, with protected values blank, so its existing loader can continue to normalize and aggregate the data. This preparation is not a substitute for organizational privacy review or confirmation that the source is approved for public use.

## Deploy

1. Commit `app.py`, `requirements.txt`, `.streamlit/config.toml`, the dashboard assets, the sanitizer, and the reviewed sanitized CSV to a GitHub repository.
2. In Streamlit Community Cloud, create an app for that repository, select the branch, and set the main file to `app.py`.
3. Launch the app and verify that the dashboard loads its CSV, filters, KPIs, charts, tooltips, responsive layout, and load-error/empty states work in the hosted environment.

The app intentionally stops with an explanatory error when the sanitized deployment CSV is absent or fails direct-identifier validation. D3.js is loaded from the D3 v7 CDN, so the browser must be able to reach `https://d3js.org`.
