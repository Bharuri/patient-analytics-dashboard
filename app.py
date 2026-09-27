from __future__ import annotations

import csv
import re
from pathlib import Path

import streamlit as st


ROOT = Path(__file__).resolve().parent
D3_DIR = ROOT / "d3"
STATIC_DIR = ROOT / "static"
DEPLOYMENT_CSV = STATIC_DIR / "healthcare_pharma.csv"

PROTECTED_COLUMNS = (
    "mrn",
    "patient_name",
    "date_of_birth",
    "city",
    "attending_physician",
    "created_at",
)


@st.cache_data(show_spinner=False)
def validate_deployment_csv(
    csv_path: str,
    modified_time: float,
) -> tuple[int, str | None]:

    del modified_time

    path = Path(csv_path)

    if not path.is_file():
        return 0, None

    with path.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as csv_file:

        reader = csv.DictReader(csv_file)

        fields = set(reader.fieldnames or ())

        missing = set(PROTECTED_COLUMNS).difference(fields)

        if missing:
            return (
                0,
                "Deployment CSV is missing required schema columns: "
                + ", ".join(sorted(missing))
                + ".",
            )

        rows = 0

        for line_number, record in enumerate(reader, start=2):

            rows += 1

            for column in PROTECTED_COLUMNS:

                if (record.get(column) or "").strip():

                    return (
                        0,
                        f"Deployment CSV contains a value in "
                        f"protected field '{column}' "
                        f"(row {line_number}).",
                    )

            patient_id = (record.get("patient_id") or "").strip()

            if patient_id and not re.fullmatch(
                r"ANON-\d{6,}",
                patient_id,
            ):
                return (
                    0,
                    f"Deployment CSV patient_id values must be "
                    f"anonymized (row {line_number}).",
                )

            age_text = (record.get("age") or "").strip()

            if age_text:

                try:

                    if float(age_text) > 90:
                        return (
                            0,
                            f"Deployment CSV ages over 90 must be "
                            f"grouped (row {line_number}).",
                        )

                except ValueError:
                    pass

    if rows == 0:
        return 0, "Deployment CSV contains no data rows."

    return rows, None


def build_dashboard_html() -> str:

    page = (D3_DIR / "index.html").read_text(
        encoding="utf-8"
    )

    styles = (D3_DIR / "styles.css").read_text(
        encoding="utf-8"
    )

    data_script = (D3_DIR / "data.js").read_text(
        encoding="utf-8"
    )

    app_script = (D3_DIR / "app.js").read_text(
        encoding="utf-8"
    )

    # Remove external CSS reference because CSS is embedded below.
    page = re.sub(
        r'<link\b[^>]*href=["\'](?:\./)?styles\.css["\'][^>]*>',
        "",
        page,
        flags=re.IGNORECASE,
    )

    # Remove external JS references.
    page = re.sub(
        r'<script\b[^>]*src=["\'][^"\']+["\'][^>]*>\s*</script>',
        "",
        page,
        flags=re.IGNORECASE,
    )

    # Embed CSS + D3.
    head_assets = f"""
<style>
{styles}
</style>

<script src="https://d3js.org/d3.v7.min.js"></script>
"""

    page = page.replace(
        "</head>",
        head_assets + "</head>",
        1,
    )

    # Prevent </script> inside JS source from terminating
    # the surrounding HTML script tag.
    data_script = re.sub(
        r"</script",
        r"<\/script",
        data_script,
        flags=re.IGNORECASE,
    )

    app_script = re.sub(
        r"</script",
        r"<\/script",
        app_script,
        flags=re.IGNORECASE,
    )

    # IMPORTANT:
    # Use the Streamlit static URL expected by the deployed app.
    runtime_assets = f"""
<script>
window.PATIENT_ANALYTICS_CSV_URL =
    "/app/static/healthcare_pharma.csv";
</script>

<script>
{data_script}
</script>

<script>
{app_script}
</script>
"""

    page = page.replace(
        "</body>",
        runtime_assets + "</body>",
        1,
    )

    return page


# ---------------------------------------------------------
# Streamlit application
# ---------------------------------------------------------

st.set_page_config(
    page_title="Patient Analytics Dashboard",
    layout="wide",
)


# ---------------------------------------------------------
# Validate deployment dataset
# ---------------------------------------------------------

if not DEPLOYMENT_CSV.is_file():

    st.error(
        "The sanitized deployment dataset is missing. "
        "Run scripts/prepare_deployment_data.py locally, "
        "review static/healthcare_pharma.csv, then commit "
        "that sanitized file before deployment."
    )

    st.stop()


row_count, validation_error = validate_deployment_csv(
    str(DEPLOYMENT_CSV),
    DEPLOYMENT_CSV.stat().st_mtime,
)


if validation_error:

    st.error(validation_error)

    st.stop()


# ---------------------------------------------------------
# Render D3 dashboard
# ---------------------------------------------------------

dashboard_html = build_dashboard_html()

st.iframe(
    dashboard_html,
    height=3600,
    width="stretch",
)