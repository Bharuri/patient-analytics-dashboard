"""Create a deployment CSV with direct patient identifiers removed.

Run this locally before publishing. The original source CSV must not be committed.
"""

from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_CSV = ROOT / "Data" / "healthcare_pharma.csv"
DEPLOYMENT_CSV = ROOT / "static" / "healthcare_pharma.csv"
DIRECT_IDENTIFIERS = ("mrn", "patient_name", "date_of_birth")
OTHER_DIRECT_DETAILS = ("city", "attending_physician", "created_at")


def prepare_deployment_data(source: Path = SOURCE_CSV, destination: Path = DEPLOYMENT_CSV) -> int:
    if not source.is_file():
        raise FileNotFoundError(f"Source CSV not found: {source}")
    if source.resolve() == destination.resolve():
        raise ValueError("The deployment CSV must not overwrite the source CSV.")

    destination.parent.mkdir(parents=True, exist_ok=True)
    with source.open("r", encoding="utf-8-sig", newline="") as source_file:
        reader = csv.DictReader(source_file)
        if not reader.fieldnames:
            raise ValueError("Source CSV has no header row.")
        required_fields = {"patient_id", *DIRECT_IDENTIFIERS}
        missing_fields = required_fields.difference(reader.fieldnames)
        if missing_fields:
            raise ValueError(f"Source CSV is missing fields: {', '.join(sorted(missing_fields))}")

        patient_ids: dict[str, str] = {}
        row_count = 0
        with destination.open("w", encoding="utf-8", newline="") as deployment_file:
            writer = csv.DictWriter(deployment_file, fieldnames=reader.fieldnames, extrasaction="ignore")
            writer.writeheader()

            for record in reader:
                original_patient_id = (record.get("patient_id") or "").strip()
                if original_patient_id:
                    if original_patient_id not in patient_ids:
                        patient_ids[original_patient_id] = f"ANON-{len(patient_ids) + 1:06d}"
                    record["patient_id"] = patient_ids[original_patient_id]
                else:
                    record["patient_id"] = ""

                for field in (*DIRECT_IDENTIFIERS, *OTHER_DIRECT_DETAILS):
                    if field in record:
                        record[field] = ""

                age_text = (record.get("age") or "").strip()
                try:
                    age = float(age_text)
                except ValueError:
                    age = None
                if age is not None and age >= 90:
                    record["age"] = "90"

                writer.writerow(record)
                row_count += 1

    if row_count == 0:
        destination.unlink(missing_ok=True)
        raise ValueError("Source CSV has no data rows; no deployment CSV was created.")
    return row_count


if __name__ == "__main__":
    count = prepare_deployment_data()
    print(f"Prepared {count:,} de-identified rows at {DEPLOYMENT_CSV}")
    print("Review this deployment CSV before committing it or publishing the dashboard.")
