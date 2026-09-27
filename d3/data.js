(function attachPatientDataLoader(global) {
  const EXPECTED_COLUMNS = [
    "patient_id",
    "mrn",
    "patient_name",
    "date_of_birth",
    "age",
    "gender",
    "blood_type",
    "city",
    "insurance_provider",
    "admission_date",
    "discharge_date",
    "department",
    "primary_diagnosis",
    "secondary_diagnosis",
    "attending_physician",
    "medications_prescribed",
    "vital_signs_bp_systolic",
    "vital_signs_bp_diastolic",
    "vital_signs_heart_rate",
    "vital_signs_temperature",
    "lab_result_glucose",
    "lab_result_hemoglobin",
    "length_of_stay_days",
    "readmission_30days",
    "discharge_status",
    "total_charges_eur",
    "insurance_coverage_pct",
    "payment_status",
    "satisfaction_score",
    "created_at",
  ];

  const NUMERIC_FIELDS = [
    "age",
    "vital_signs_bp_systolic",
    "vital_signs_bp_diastolic",
    "vital_signs_heart_rate",
    "vital_signs_temperature",
    "lab_result_glucose",
    "lab_result_hemoglobin",
    "length_of_stay_days",
    "total_charges_eur",
    "insurance_coverage_pct",
    "satisfaction_score",
  ];

  const DATE_FIELDS = [
    "date_of_birth",
    "admission_date",
    "discharge_date",
    "created_at",
  ];

  const LOWERCASE_CATEGORIES = [
    "gender",
    "city",
    "insurance_provider",
    "department",
    "attending_physician",
    "medications_prescribed",
    "discharge_status",
    "payment_status",
  ];

  const DIAGNOSIS_FIELDS = ["primary_diagnosis", "secondary_diagnosis"];

  function cleanText(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim().replace(/\s+/g, " ");
  }

  function parseNumber(value) {
    const text = cleanText(value);
    if (text === "") return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function createDateParsers(d3) {
    return [
      d3.timeParse("%Y-%m-%d %H:%M:%S"),
      d3.timeParse("%Y-%m-%dT%H:%M:%S"),
      d3.timeParse("%Y-%m-%d %H:%M"),
      d3.timeParse("%Y-%m-%d"),
      d3.timeParse("%d/%m/%Y"),
      d3.timeParse("%d-%m-%Y"),
    ];
  }

  function parseDate(value, dateParsers) {
    const text = cleanText(value);
    if (text === "") return null;

    for (const parse of dateParsers) {
      const date = parse(text);
      if (date instanceof Date && Number.isFinite(date.getTime())) return date;
    }
    return null;
  }

  function parseBoolean(value) {
    const text = cleanText(value).toLowerCase();
    if (text === "") return null;
    if (["true", "1", "yes", "y"].includes(text)) return true;
    if (["false", "0", "no", "n"].includes(text)) return false;
    return null;
  }

  function normalizeRecord(row, dateParsers) {
    const record = { ...row };
    const dataIssues = [];

    for (const field of NUMERIC_FIELDS) {
      const sourceValue = row[field];
      record[field] = parseNumber(sourceValue);
      if (cleanText(sourceValue) !== "" && record[field] === null) {
        dataIssues.push(`${field}: invalid numeric value`);
      }
    }

    for (const field of DATE_FIELDS) {
      const sourceValue = row[field];
      record[field] = parseDate(sourceValue, dateParsers);
      if (cleanText(sourceValue) !== "" && record[field] === null) {
        dataIssues.push(`${field}: invalid date value`);
      }
    }

    const readmissionValue = row.readmission_30days;
    record.readmission_30days = parseBoolean(readmissionValue);
    if (cleanText(readmissionValue) !== "" && record.readmission_30days === null) {
      dataIssues.push("readmission_30days: invalid boolean value");
    }

    for (const field of LOWERCASE_CATEGORIES) {
      const text = cleanText(row[field]);
      record[field] = text === "" ? null : text.toLocaleLowerCase("en");
    }

    for (const field of DIAGNOSIS_FIELDS) {
      const text = cleanText(row[field]);
      record[field] = text === "" ? null : text.toLocaleUpperCase("en");
    }

    const bloodType = cleanText(row.blood_type);
    record.blood_type = bloodType === "" ? null : bloodType.toLocaleUpperCase("en");

    for (const field of ["patient_id", "mrn", "patient_name", "secondary_diagnosis"]) {
      const text = cleanText(row[field]);
      record[field] = text === "" ? null : text;
    }

    if (record.patient_id === null) dataIssues.push("patient_id: missing required value");
    if (record.admission_date === null) dataIssues.push("admission_date: missing or invalid required value");

    record.dataIssues = dataIssues;
    return record;
  }

  async function loadHealthcareData(d3, sourceUrl) {
    if (!d3 || typeof d3.csv !== "function" || typeof d3.timeParse !== "function") {
      throw new Error("D3.js CSV and date parsing functions are unavailable.");
    }
    if (!sourceUrl) throw new Error("A healthcare CSV source URL is required.");

    const sourceRecords = await d3.csv(sourceUrl);
    const columns = Array.isArray(sourceRecords.columns) ? sourceRecords.columns : [];
    const missingColumns = EXPECTED_COLUMNS.filter((column) => !columns.includes(column));
    const dateParsers = createDateParsers(d3);
    const records = sourceRecords.map((row) => normalizeRecord(row, dateParsers));
    const dataIssueCount = records.reduce((total, record) => total + record.dataIssues.length, 0);

    return {
      sourceRecords,
      records,
      missingColumns,
      dataIssueCount,
    };
  }

  global.PatientAnalyticsData = Object.freeze({
    expectedColumns: Object.freeze([...EXPECTED_COLUMNS]),
    loadHealthcareData,
  });
})(window);
