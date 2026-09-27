/* Dashboard startup: load and normalize the source dataset once. */
(function startDashboard() {
	let dashboardData = null;
	let filteredRecords = [];
	let lastChartGridWidth = 0;
	let resizeFrame = null;
	let chartGridResizeObserver = null;
	const filterDefaults = {
		department: null,
		gender: null,
		startDate: "",
		endDate: "",
		insuranceProvider: null,
		timeGranularity: "month",
	};
	const filterState = { ...filterDefaults };
	const dateInputParser = window.d3?.timeParse("%Y-%m-%d");
	const allowedGranularities = new Set(["month", "quarter", "year"]);
	const countFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
	const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
	const percentFormatter = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
	const dateInputs = {
		department: document.querySelector('[name="department"]'),
		gender: document.querySelector('[name="gender"]'),
		startDate: document.querySelector('[name="start-date"]'),
		endDate: document.querySelector('[name="end-date"]'),
		insuranceProvider: document.querySelector('[name="insurance-provider"]'),
		timeGranularity: document.querySelector('[name="time-granularity"]'),
	};

	window.patientAnalyticsData = null;
	window.patientAnalyticsState = {
		filters: filterState,
		get filteredRecords() {
			return filteredRecords;
		},
		applyFilters,
		resetFilters,
	};

	function addFilterOptions(select, field, records) {
		if (!select) return;

		const allOption = select.options[0];
		select.replaceChildren(allOption);
		const values = [...new Set(records.map((record) => record[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

		for (const value of values) {
			const option = document.createElement("option");
			option.value = value;
			option.textContent = value;
			select.append(option);
		}
	}

	function updateFilterStateFromControls() {
		filterState.department = dateInputs.department?.value || null;
		filterState.gender = dateInputs.gender?.value || null;
		filterState.startDate = dateInputs.startDate?.value || "";
		filterState.endDate = dateInputs.endDate?.value || "";
		filterState.insuranceProvider = dateInputs.insuranceProvider?.value || null;

		const granularity = dateInputs.timeGranularity?.value;
		filterState.timeGranularity = allowedGranularities.has(granularity) ? granularity : filterDefaults.timeGranularity;
	}

	function parseDateBoundary(value, inclusiveEnd = false) {
		if (!value || typeof dateInputParser !== "function") return null;

		const date = dateInputParser(value);
		if (!date || !Number.isFinite(date.getTime())) return null;
		if (!inclusiveEnd) return date;

		return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
	}

	function calculateKpis(records) {
		const uniquePatientIds = new Set(records.map((record) => record.patient_id).filter(Boolean));
		const lengthOfStayValues = records.map((record) => record.length_of_stay_days).filter(Number.isFinite);
		const satisfactionValues = records.map((record) => record.satisfaction_score).filter(Number.isFinite);
		const totalCharges = records.reduce((total, record) => {
			return Number.isFinite(record.total_charges_eur) ? total + record.total_charges_eur : total;
		}, 0);
		const readmissionCount = records.filter((record) => record.readmission_30days === true).length;

		return {
			totalPatients: uniquePatientIds.size,
			totalAdmissions: records.length,
			averageLengthOfStay: lengthOfStayValues.length
				? lengthOfStayValues.reduce((total, value) => total + value, 0) / lengthOfStayValues.length
				: null,
			readmissionRate: records.length ? (readmissionCount / records.length) * 100 : 0,
			averageSatisfactionScore: satisfactionValues.length
				? satisfactionValues.reduce((total, value) => total + value, 0) / satisfactionValues.length
				: null,
			totalCharges,
		};
	}

	function renderKpis(records) {
		if (records.length === 0) {
			for (const cardValue of document.querySelectorAll("[data-kpi]")) cardValue.textContent = "—";
			return;
		}

		const kpis = calculateKpis(records);
		const formattedValues = {
			"total-patients": countFormatter.format(kpis.totalPatients),
			"total-admissions": countFormatter.format(kpis.totalAdmissions),
			"average-length-of-stay": kpis.averageLengthOfStay === null ? "—" : decimalFormatter.format(kpis.averageLengthOfStay),
			"readmission-rate": `${percentFormatter.format(kpis.readmissionRate)}%`,
			"average-satisfaction-score": kpis.averageSatisfactionScore === null ? "—" : decimalFormatter.format(kpis.averageSatisfactionScore),
			"total-charges": currencyFormatter.format(kpis.totalCharges),
		};

		for (const [metric, value] of Object.entries(formattedValues)) {
			const cardValue = document.querySelector(`[data-kpi="${metric}"]`);
			if (cardValue) cardValue.textContent = value;
		}
	}

	function formatDepartmentLabel(department) {
		return department.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
	}

	function renderChartEmptyState(containerId) {
		const container = document.getElementById(containerId);
		if (!container) return;

		container.replaceChildren();
		const message = document.createElement("p");
		message.className = "chart-empty-state";
		message.setAttribute("role", "status");
		message.textContent = filteredRecords.length === 0
			? "No records match the current filters."
			: "No valid data is available for this chart.";
		container.append(message);
	}

	function updateDashboardEmptyState(records) {
		const emptyState = document.getElementById("dashboard-empty-state");
		if (!emptyState) return;

		emptyState.textContent = "No records match the current filters. KPI values and charts are unavailable.";
		emptyState.hidden = records.length > 0;
	}

	function tooltipPosition(event) {
		if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
			return { x: event.clientX, y: event.clientY };
		}

		const bounds = event.currentTarget.getBoundingClientRect();
		return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
	}

	function positionChartTooltip(event) {
		const tooltip = document.getElementById("chart-tooltip");
		if (!tooltip || tooltip.hidden) return;

		const point = tooltipPosition(event);
		const bounds = tooltip.getBoundingClientRect();
		const viewportPadding = 12;
		const offset = 14;
		let left = point.x + offset;
		let top = point.y + offset;

		if (left + bounds.width > window.innerWidth - viewportPadding) left = point.x - bounds.width - offset;
		if (top + bounds.height > window.innerHeight - viewportPadding) top = point.y - bounds.height - offset;

		tooltip.style.left = `${Math.max(viewportPadding, left)}px`;
		tooltip.style.top = `${Math.max(viewportPadding, top)}px`;
	}

	function showChartTooltip(event, content) {
		const tooltip = document.getElementById("chart-tooltip");
		if (!tooltip) return;

		const title = document.createElement("p");
		title.className = "chart-tooltip-title";
		title.textContent = content.title;
		const detail = document.createElement("p");
		detail.className = "chart-tooltip-detail";
		detail.textContent = content.detail;
		tooltip.replaceChildren(title, detail);
		tooltip.hidden = false;
		tooltip.setAttribute("aria-hidden", "false");
		positionChartTooltip(event);
	}

	function hideChartTooltip() {
		const tooltip = document.getElementById("chart-tooltip");
		if (!tooltip) return;

		tooltip.hidden = true;
		tooltip.setAttribute("aria-hidden", "true");
	}

	function bindChartTooltip(selection, getContent) {
		selection
			.attr("aria-describedby", "chart-tooltip")
			.on("pointerenter.chartTooltip", (event, datum) => showChartTooltip(event, getContent(datum)))
			.on("pointermove.chartTooltip", positionChartTooltip)
			.on("pointerleave.chartTooltip", hideChartTooltip)
			.on("focus.chartTooltip", (event, datum) => showChartTooltip(event, getContent(datum)))
			.on("blur.chartTooltip", hideChartTooltip);
	}

	function aggregateByDepartment(records, aggregate) {
		return window.d3.rollups(
			records.filter((record) => record.department),
			aggregate,
			(record) => record.department,
		)
			.map(([department, value]) => ({ department, value }))
			.filter((summary) => summary.value !== null)
			.sort((left, right) => left.department.localeCompare(right.department));
	}

	function meanField(records, field) {
		const values = records.map((record) => record[field]).filter(Number.isFinite);
		return values.length ? window.d3.mean(values) : null;
	}

	function selectDepartment(department) {
		if (!dateInputs.department) return;

		dateInputs.department.value = filterState.department === department ? "" : department;
		updateFilterStateFromControls();
		applyFilters();
	}

	function renderDepartmentBarChart(containerId, summaries, chartLabel, valueFormatter, tooltipValueLabel) {
		const container = document.getElementById(containerId);
		if (!container) return;

		container.replaceChildren();
		if (summaries.length === 0) {
			renderChartEmptyState(containerId);
			return;
		}

		const d3 = window.d3;
		const width = Math.max(1, Math.floor(container.clientWidth || 260));
		const height = 300;
		const margin = { top: 12, right: 14, bottom: 42, left: width < 380 ? 104 : 126 };
		const plotWidth = width - margin.left - margin.right;
		const plotHeight = height - margin.top - margin.bottom;
		const maxValue = d3.max(summaries, (summary) => summary.value) || 0;
		const x = d3.scaleLinear().domain([0, maxValue > 0 ? maxValue : 1]).nice().range([0, plotWidth]);
		const y = d3.scaleBand()
			.domain(summaries.map((summary) => summary.department))
			.range([0, plotHeight])
			.padding(0.2);
		const svg = d3.select(container)
			.append("svg")
			.attr("class", "department-chart-svg")
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("role", "group")
			.attr("aria-label", chartLabel);
		const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

		plot.append("g")
			.attr("class", "department-chart-axis")
			.call(d3.axisLeft(y).tickSizeOuter(0).tickFormat(formatDepartmentLabel));

		plot.append("g")
			.attr("class", "department-chart-axis")
			.attr("transform", `translate(0,${plotHeight})`)
			.call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(plotWidth / 58))).tickSizeOuter(0).tickFormat(valueFormatter));

		const bars = plot.selectAll(".department-bar")
			.data(summaries)
			.join("rect")
			.attr("class", "department-bar")
			.attr("x", 0)
			.attr("y", (summary) => y(summary.department))
			.attr("width", (summary) => Math.max(0, x(summary.value)))
			.attr("height", y.bandwidth())
			.attr("rx", 4)
			.attr("fill", (summary) => filterState.department === summary.department ? "#0e625f" : "#58a99e")
			.attr("role", "button")
			.attr("tabindex", 0)
			.attr("aria-pressed", (summary) => String(filterState.department === summary.department))
			.attr("aria-label", (summary) => `${formatDepartmentLabel(summary.department)}: ${valueFormatter(summary.value)}; select department`)
			.on("click", (event, summary) => selectDepartment(summary.department))
			.on("keydown", (event, summary) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					selectDepartment(summary.department);
				}
			});
		bindChartTooltip(bars, (summary) => ({
			title: formatDepartmentLabel(summary.department),
			detail: `${tooltipValueLabel}: ${valueFormatter(summary.value)}`,
		}));
	}

	function renderDepartmentCharts(records) {
		const patientCounts = aggregateByDepartment(records, (departmentRecords) => {
			return new Set(departmentRecords.map((record) => record.patient_id).filter(Boolean)).size;
		});
		const averageLengthOfStay = aggregateByDepartment(records, (departmentRecords) => {
			return meanField(departmentRecords, "length_of_stay_days");
		});
		const averageCharges = aggregateByDepartment(records, (departmentRecords) => {
			return meanField(departmentRecords, "total_charges_eur");
		});

		renderDepartmentBarChart("patients-by-department-chart", patientCounts, "Unique patients by department", window.d3.format(",d"), "Patients");
		renderDepartmentBarChart("average-length-of-stay-by-department-chart", averageLengthOfStay, "Average length of stay by department", window.d3.format(".1f"), "Average length of stay in days");
		renderDepartmentBarChart("average-charges-by-department-chart", averageCharges, "Average charges by department in euros", (value) => `€${window.d3.format(".2s")(value)}`, "Average charges");
	}

	function getTimeBucket(date, granularity) {
		const d3 = window.d3;
		if (granularity === "quarter") return d3.timeMonth.every(3).floor(date);
		if (granularity === "year") return d3.timeYear.floor(date);
		return d3.timeMonth.floor(date);
	}

	function formatTimeBucket(date, granularity) {
		const d3 = window.d3;
		if (granularity === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
		if (granularity === "year") return d3.timeFormat("%Y")(date);
		return d3.timeFormat("%b %Y")(date);
	}

	function renderTimeAnalysisChart(records) {
		const container = document.getElementById("admissions-over-time-chart");
		if (!container) return;

		container.replaceChildren();
		const d3 = window.d3;
		const granularity = filterState.timeGranularity;
		const summaries = d3.rollups(
			records.filter((record) => record.admission_date instanceof Date && Number.isFinite(record.admission_date.getTime())),
			(admissions) => admissions.length,
			(record) => +getTimeBucket(record.admission_date, granularity),
		)
			.map(([timestamp, admissions]) => ({ date: new Date(timestamp), admissions }))
			.sort((left, right) => left.date - right.date);
		if (summaries.length === 0) {
			renderChartEmptyState("admissions-over-time-chart");
			return;
		}

		const width = Math.max(1, Math.floor(container.clientWidth || 280));
		const height = 320;
		const compact = width < 440;
		const margin = { top: 18, right: compact ? 12 : 24, bottom: compact ? 44 : 48, left: compact ? 44 : 56 };
		const plotWidth = width - margin.left - margin.right;
		const plotHeight = height - margin.top - margin.bottom;
		let timeDomain;

		if (summaries.length > 1) {
			timeDomain = [summaries[0].date, summaries[summaries.length - 1].date];
		} else if (summaries.length === 1) {
			const date = summaries[0].date;
			const padding = granularity === "year" ? d3.timeYear : d3.timeMonth;
			const amount = granularity === "quarter" ? 3 : 1;
			timeDomain = [padding.offset(date, -amount), padding.offset(date, amount)];
		} else {
			timeDomain = [new Date(2000, 0, 1), new Date(2001, 0, 1)];
		}

		const maxAdmissions = d3.max(summaries, (summary) => summary.admissions) || 0;
		const x = d3.scaleTime().domain(timeDomain).range([0, plotWidth]);
		const y = d3.scaleLinear().domain([0, maxAdmissions > 0 ? maxAdmissions : 1]).nice().range([plotHeight, 0]);
		const svg = d3.select(container)
			.append("svg")
			.attr("class", "admissions-time-chart-svg")
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("role", "img")
			.attr("aria-label", `Admissions by ${granularity}`);
		const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
		const xAxisFormatter = (date) => formatTimeBucket(date, granularity);
		const xTickInterval = granularity === "quarter"
			? d3.timeMonth.every(3)
			: granularity === "year"
				? d3.timeYear.every(1)
				: Math.max(2, Math.floor(plotWidth / 88));
		const line = d3.line()
			.x((summary) => x(summary.date))
			.y((summary) => y(summary.admissions));

		plot.append("g")
			.attr("class", "admissions-time-axis")
			.call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",d")).tickSizeOuter(0));

		plot.append("g")
			.attr("class", "admissions-time-axis")
			.attr("transform", `translate(0,${plotHeight})`)
			.call(d3.axisBottom(x).ticks(xTickInterval).tickFormat(xAxisFormatter).tickSizeOuter(0));

		if (summaries.length > 0) {
			plot.append("path")
				.datum(summaries)
				.attr("class", "admissions-line")
				.attr("d", line);

			const points = plot.selectAll(".admissions-point")
				.data(summaries)
				.join("circle")
				.attr("class", "admissions-point")
				.attr("cx", (summary) => x(summary.date))
				.attr("cy", (summary) => y(summary.admissions))
				.attr("r", 3.5)
				.attr("aria-label", (summary) => `${xAxisFormatter(summary.date)}: ${summary.admissions} admissions`);
			bindChartTooltip(points, (summary) => ({
				title: xAxisFormatter(summary.date),
				detail: `Admissions: ${d3.format(",d")(summary.admissions)}`,
			}));
		}
	}

	function renderDiagnosisChart(records) {
		const container = document.getElementById("top-diagnoses-chart");
		if (!container) return;

		container.replaceChildren();
		const d3 = window.d3;
		const diagnoses = d3.rollups(
			records.filter((record) => record.primary_diagnosis && record.patient_id),
			(diagnosisRecords) => new Set(diagnosisRecords.map((record) => record.patient_id)).size,
			(record) => record.primary_diagnosis,
		)
			.map(([diagnosis, patientCount]) => ({ diagnosis, patientCount }))
			.sort((left, right) => right.patientCount - left.patientCount || left.diagnosis.localeCompare(right.diagnosis))
			.slice(0, 10);
		if (diagnoses.length === 0) {
			renderChartEmptyState("top-diagnoses-chart");
			return;
		}

		const width = Math.max(1, Math.floor(container.clientWidth || 260));
		const height = 320;
		const margin = { top: 12, right: 14, bottom: 42, left: width < 360 ? 64 : 76 };
		const plotWidth = width - margin.left - margin.right;
		const plotHeight = height - margin.top - margin.bottom;
		const maxPatients = d3.max(diagnoses, (diagnosis) => diagnosis.patientCount) || 0;
		const x = d3.scaleLinear().domain([0, maxPatients > 0 ? maxPatients : 1]).nice().range([0, plotWidth]);
		const y = d3.scaleBand()
			.domain(diagnoses.map((diagnosis) => diagnosis.diagnosis))
			.range([0, plotHeight])
			.padding(0.2);
		const svg = d3.select(container)
			.append("svg")
			.attr("class", "diagnosis-chart-svg")
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("role", "img")
			.attr("aria-label", "Top 10 primary diagnoses by patient count");
		const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

		plot.append("g")
			.attr("class", "diagnosis-chart-axis")
			.call(d3.axisLeft(y).tickSizeOuter(0));

		plot.append("g")
			.attr("class", "diagnosis-chart-axis")
			.attr("transform", `translate(0,${plotHeight})`)
			.call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(plotWidth / 58))).tickFormat(d3.format(",d")).tickSizeOuter(0));

		const bars = plot.selectAll(".diagnosis-bar")
			.data(diagnoses)
			.join("rect")
			.attr("class", "diagnosis-bar")
			.attr("x", 0)
			.attr("y", (diagnosis) => y(diagnosis.diagnosis))
			.attr("width", (diagnosis) => Math.max(0, x(diagnosis.patientCount)))
			.attr("height", y.bandwidth())
			.attr("rx", 4)
			.attr("aria-label", (diagnosis) => `${diagnosis.diagnosis}: ${d3.format(",d")(diagnosis.patientCount)} patients`);
		bindChartTooltip(bars, (diagnosis) => ({
			title: `Primary diagnosis: ${diagnosis.diagnosis}`,
			detail: `Patients: ${d3.format(",d")(diagnosis.patientCount)}`,
		}));
	}

	function countUniquePatientsByCategory(records, categoryAccessor) {
		const categorizedRecords = records
			.filter((record) => record.patient_id)
			.map((record) => ({ patientId: record.patient_id, category: categoryAccessor(record) }))
			.filter(({ category }) => category !== null && category !== undefined && category !== "");

		return window.d3.rollups(
			categorizedRecords,
			(categoryRecords) => new Set(categoryRecords.map((record) => record.patientId)).size,
			(record) => record.category,
		).map(([category, patientCount]) => ({ category, patientCount }));
	}

	function normalizeGenderCategory(gender) {
		if (gender === "f" || gender === "female") return "Female";
		if (gender === "m" || gender === "male") return "Male";
		return formatDepartmentLabel(gender);
	}

	function renderDemographicBarChart(containerId, summaries, chartLabel, tooltipLabel) {
		const container = document.getElementById(containerId);
		if (!container) return;

		container.replaceChildren();
		if (summaries.length === 0) {
			renderChartEmptyState(containerId);
			return;
		}

		const d3 = window.d3;
		const width = Math.max(1, Math.floor(container.clientWidth || 260));
		const height = 320;
		const margin = { top: 12, right: 14, bottom: 42, left: width < 360 ? 82 : 92 };
		const plotWidth = width - margin.left - margin.right;
		const plotHeight = height - margin.top - margin.bottom;
		const maxPatients = d3.max(summaries, (summary) => summary.patientCount) || 0;
		const x = d3.scaleLinear().domain([0, maxPatients > 0 ? maxPatients : 1]).nice().range([0, plotWidth]);
		const y = d3.scaleBand()
			.domain(summaries.map((summary) => summary.category))
			.range([0, plotHeight])
			.padding(0.2);
		const svg = d3.select(container)
			.append("svg")
			.attr("class", "demographic-chart-svg")
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("role", "img")
			.attr("aria-label", chartLabel);
		const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

		plot.append("g")
			.attr("class", "demographic-chart-axis")
			.call(d3.axisLeft(y).tickSizeOuter(0));

		plot.append("g")
			.attr("class", "demographic-chart-axis")
			.attr("transform", `translate(0,${plotHeight})`)
			.call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(plotWidth / 58))).tickFormat(d3.format(",d")).tickSizeOuter(0));

		const bars = plot.selectAll(".demographic-bar")
			.data(summaries)
			.join("rect")
			.attr("class", "demographic-bar")
			.attr("x", 0)
			.attr("y", (summary) => y(summary.category))
			.attr("width", (summary) => Math.max(0, x(summary.patientCount)))
			.attr("height", y.bandwidth())
			.attr("rx", 4)
			.attr("aria-label", (summary) => `${summary.category}: ${d3.format(",d")(summary.patientCount)} patients`);
		bindChartTooltip(bars, (summary) => ({
			title: `${tooltipLabel}: ${summary.category}`,
			detail: `Patients: ${d3.format(",d")(summary.patientCount)}`,
		}));
	}

	function renderDemographicCharts(records) {
		const ageDistribution = countUniquePatientsByCategory(records, (record) => {
			return Number.isFinite(record.age) && record.age >= 0 ? Math.floor(record.age / 10) * 10 : null;
		})
			.map(({ category, patientCount }) => ({
				category: `${category}–${category + 9}`,
				patientCount,
				ageBandStart: category,
			}))
			.sort((left, right) => left.ageBandStart - right.ageBandStart)
			.map(({ category, patientCount }) => ({ category, patientCount }));
		const genderDistribution = countUniquePatientsByCategory(records, (record) => {
			return record.gender ? normalizeGenderCategory(record.gender) : null;
		}).sort((left, right) => left.category.localeCompare(right.category));
		const bloodTypeDistribution = countUniquePatientsByCategory(records, (record) => {
			if (!record.blood_type) return null;
			return record.blood_type === "UNKNOWN" ? "Unknown" : record.blood_type;
		}).sort((left, right) => left.category.localeCompare(right.category));

		renderDemographicBarChart("age-distribution-chart", ageDistribution, "Age distribution by patient count", "Age range");
		renderDemographicBarChart("gender-distribution-chart", genderDistribution, "Gender distribution by patient count", "Gender");
		renderDemographicBarChart("blood-type-distribution-chart", bloodTypeDistribution, "Blood type distribution by patient count", "Blood type");
	}

	function renderFinancialBarChart(containerId, summaries, chartLabel, valueFormatter, tooltipContent) {
		const container = document.getElementById(containerId);
		if (!container) return;

		container.replaceChildren();
		if (summaries.length === 0) {
			renderChartEmptyState(containerId);
			return;
		}

		const d3 = window.d3;
		const width = Math.max(1, Math.floor(container.clientWidth || 260));
		const height = 300;
		const margin = { top: 12, right: 14, bottom: 42, left: width < 360 ? 96 : 112 };
		const plotWidth = width - margin.left - margin.right;
		const plotHeight = height - margin.top - margin.bottom;
		const maxValue = d3.max(summaries, (summary) => summary.value) || 0;
		const x = d3.scaleLinear().domain([0, maxValue > 0 ? maxValue : 1]).nice().range([0, plotWidth]);
		const y = d3.scaleBand()
			.domain(summaries.map((summary) => summary.category))
			.range([0, plotHeight])
			.padding(0.2);
		const svg = d3.select(container)
			.append("svg")
			.attr("class", "financial-chart-svg")
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("role", "img")
			.attr("aria-label", chartLabel);
		const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

		plot.append("g")
			.attr("class", "financial-chart-axis")
			.call(d3.axisLeft(y).tickSizeOuter(0).tickFormat(formatDepartmentLabel));

		plot.append("g")
			.attr("class", "financial-chart-axis")
			.attr("transform", `translate(0,${plotHeight})`)
			.call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(plotWidth / 58))).tickSizeOuter(0).tickFormat(valueFormatter));

		const bars = plot.selectAll(".financial-bar")
			.data(summaries)
			.join("rect")
			.attr("class", "financial-bar")
			.attr("x", 0)
			.attr("y", (summary) => y(summary.category))
			.attr("width", (summary) => Math.max(0, x(summary.value)))
			.attr("height", y.bandwidth())
			.attr("rx", 4)
			.attr("aria-label", (summary) => `${formatDepartmentLabel(summary.category)}: ${valueFormatter(summary.value)}`);
		bindChartTooltip(bars, tooltipContent);
	}

	function renderFinancialCharts(records) {
		const d3 = window.d3;
		const chargesByDepartment = d3.rollups(
			records.filter((record) => record.department && Number.isFinite(record.total_charges_eur)),
			(departmentRecords) => d3.sum(departmentRecords, (record) => record.total_charges_eur),
			(record) => record.department,
		)
			.map(([category, value]) => ({ category, value }))
			.sort((left, right) => right.value - left.value || left.category.localeCompare(right.category));
		const paymentStatuses = d3.rollups(
			records.filter((record) => record.payment_status),
			(statusRecords) => statusRecords.length,
			(record) => record.payment_status,
		)
			.map(([category, value]) => ({ category, value }))
			.sort((left, right) => right.value - left.value || left.category.localeCompare(right.category));
		const coverageValues = records.map((record) => record.insurance_coverage_pct).filter(Number.isFinite);
		const averageCoverage = coverageValues.length ? d3.mean(coverageValues) : null;
		const coverageValue = document.getElementById("insurance-coverage-value");
		const coverageCaption = document.getElementById("insurance-coverage-caption");

		if (coverageValue) {
			coverageValue.textContent = averageCoverage === null ? "—" : `${percentFormatter.format(averageCoverage)}%`;
		}
		if (coverageCaption) {
			coverageCaption.textContent = averageCoverage === null
				? records.length === 0 ? "No records match the current filters." : "No valid insurance coverage data."
				: "Across filtered admissions";
		}

		renderFinancialBarChart(
			"total-charges-by-department-chart",
			chargesByDepartment,
			"Total charges by department in euros",
			(value) => `€${d3.format(".2s")(value)}`,
			(summary) => ({
				title: formatDepartmentLabel(summary.category),
				detail: `Total charges: ${currencyFormatter.format(summary.value)}`,
			}),
		);
		renderFinancialBarChart(
			"payment-status-chart",
			paymentStatuses,
			"Payment status distribution by admission count",
			d3.format(",d"),
			(summary) => ({
				title: `Payment status: ${formatDepartmentLabel(summary.category)}`,
				detail: `Admissions: ${d3.format(",d")(summary.value)}`,
			}),
		);
	}

	function renderCharts(records) {
		hideChartTooltip();
		updateDashboardEmptyState(records);
		renderDepartmentCharts(records);
		renderTimeAnalysisChart(records);
		renderDiagnosisChart(records);
		renderDemographicCharts(records);
		renderFinancialCharts(records);
		lastChartGridWidth = document.querySelector(".chart-grid")?.clientWidth || 0;
	}

	function scheduleResponsiveChartRender() {
		if (!dashboardData || resizeFrame !== null) return;

		resizeFrame = window.requestAnimationFrame(() => {
			resizeFrame = window.requestAnimationFrame(() => {
				resizeFrame = null;
				const currentWidth = document.querySelector(".chart-grid")?.clientWidth || 0;
				if (currentWidth && currentWidth !== lastChartGridWidth) renderCharts(filteredRecords);
			});
		});
	}

	function observeChartGridResize() {
		const chartGrid = document.querySelector(".chart-grid");
		if (!chartGrid) return;

		if (typeof window.ResizeObserver === "function") {
			chartGridResizeObserver = new window.ResizeObserver(() => {
				const currentWidth = chartGrid.clientWidth;
				if (dashboardData && currentWidth > 0 && currentWidth !== lastChartGridWidth) {
					renderCharts(filteredRecords);
				}
			});
			chartGridResizeObserver.observe(chartGrid);
			return;
		}

		window.addEventListener("resize", scheduleResponsiveChartRender, { passive: true });
	}

	function applyFilters() {
		if (!dashboardData) {
			filteredRecords = [];
			return filteredRecords;
		}

		const startDate = parseDateBoundary(filterState.startDate);
		const endDateExclusive = parseDateBoundary(filterState.endDate, true);

		filteredRecords = dashboardData.records.filter((record) => {
			if (filterState.department && record.department !== filterState.department) return false;
			if (filterState.gender && record.gender !== filterState.gender) return false;
			if (filterState.insuranceProvider && record.insurance_provider !== filterState.insuranceProvider) return false;

			if (startDate || endDateExclusive) {
				const admissionDate = record.admission_date;
				if (!(admissionDate instanceof Date) || !Number.isFinite(admissionDate.getTime())) return false;
				if (startDate && admissionDate < startDate) return false;
				if (endDateExclusive && admissionDate >= endDateExclusive) return false;
			}

			return true;
		});

		renderKpis(filteredRecords);
		renderCharts(filteredRecords);
		return filteredRecords;
	}

	function resetFilters() {
		Object.assign(filterState, filterDefaults);
		for (const [key, control] of Object.entries(dateInputs)) {
			if (control) control.value = filterDefaults[key] ?? "";
		}
		return applyFilters();
	}

	function bindFilterControls() {
		for (const control of Object.values(dateInputs)) {
			control?.addEventListener("change", () => {
				updateFilterStateFromControls();
				applyFilters();
			});
		}

		document.querySelector(".reset-button")?.addEventListener("click", resetFilters);
		observeChartGridResize();
	}

	async function initializeDashboard() {
		const errorMessage = document.querySelector("#data-load-error");
		const sourceUrl = window.PATIENT_ANALYTICS_CSV_URL || new URL("../static/healthcare_pharma.csv", document.baseURI).href;
		bindFilterControls();

		try {
			dashboardData = await window.PatientAnalyticsData.loadHealthcareData(window.d3, sourceUrl);
			window.patientAnalyticsData = dashboardData;
			addFilterOptions(dateInputs.department, "department", dashboardData.records);
			addFilterOptions(dateInputs.gender, "gender", dashboardData.records);
			addFilterOptions(dateInputs.insuranceProvider, "insurance_provider", dashboardData.records);
			updateFilterStateFromControls();
			applyFilters();

			if (dashboardData.missingColumns.length > 0) {
				console.warn("Healthcare CSV is missing expected columns:", dashboardData.missingColumns);
			}
			if (dashboardData.dataIssueCount > 0) {
				console.warn("Healthcare CSV contains values that could not be normalized:", dashboardData.dataIssueCount);
			}
		} catch (error) {
			console.error("Unable to load the healthcare CSV dataset.", error);
			errorMessage.textContent = "Unable to load dashboard data. Check that the healthcare CSV is available and try again.";
			errorMessage.hidden = false;
		}
	}

	document.addEventListener("DOMContentLoaded", initializeDashboard, { once: true });
})();
