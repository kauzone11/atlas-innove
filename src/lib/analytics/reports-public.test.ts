import assert from "node:assert/strict";
import test from "node:test";
import { escapeCsvCell, MAX_EXPORT_ROWS, serializeCsv } from "@/lib/analytics/csv";
import { analyticsReportPayloadSchema, parseAnalyticsReportPayload, publicReportPayloadSchema, type AnalyticsReportPayload } from "@/lib/analytics/report-schemas";
import { buildPublicReportPayload, publicPayloadDigest, canonicalJson } from "@/lib/analytics/public-payload";
import { analyticsReturnUrl } from "@/lib/analytics/api-context";

function cohortReport(n = 6): Extract<AnalyticsReportPayload, { type: "COHORT_LONGITUDINAL" }> {
  return {
    analyticsSchemaVersion: 1, type: "COHORT_LONGITUDINAL", title: "Resultados observados", dataAsOf: "2026-10-06T12:00:00.000Z",
    scope: { organizationName: "Instituição", programId: "PRIVATE_PROGRAM_ID", programName: "Programa", cohortId: "PRIVATE_COHORT_ID", cohortName: "Coorte", callId: null, callName: null, year: null },
    methodology: { interpretation: "Evidências registradas sem atribuição causal.", eligibility: "Observações submetidas.", comparability: "Métrica canônica e mês de referência." },
    cohort: {
      id: "PRIVATE_COHORT_ID", name: "Coorte", programId: "PRIVATE_PROGRAM_ID", programName: "Programa", callId: "PRIVATE_CALL_ID", protocol: { id: "PRIVATE_PROTOCOL_ID", name: "Protocolo", version: 1 }, enrollmentCount: n,
      quality: { unmappedIndicators: 0, missingOffsets: 0, ambiguousOffsets: [] }, paired: [],
      waves: [{ id: "PRIVATE_WAVE_ID", name: "Onda inicial", offsetMonths: 0, sequence: 0, status: "CLOSED", referenceAt: "2026-10-01T00:00:00.000Z", coverage: { expected: n, submitted: n, pending: 0, inProgress: 0, missed: 0, notEligible: 0, withdrawn: 0, percentage: 100 }, metrics: [{ metricId: "PRIVATE_METRIC_ID", key: "revenue", label: "Receita observada", valueType: "CURRENCY", unit: "BRL", primaryAggregation: "TOTAL", validCount: n, missingCount: 0, sum: "0.60", mean: "0.10", median: "0.10", minimum: "0.10", maximum: "0.10", distribution: [] }] }],
    },
  };
}

test("CSV prevents formulas after whitespace and controls while retaining valid quoted UTF-8 cells", () => {
  for (const value of ["=HYPERLINK(\"https://example.test\")", "+cmd", "-cmd", "@formula", "  =formula", "\t@formula", "\u0001 \n+formula", "\r\ntext"]) assert.ok(escapeCsvCell(value).startsWith('"\''), value);
  assert.equal(escapeCsvCell("texto = conteúdo"), '"texto = conteúdo"');
  assert.equal(escapeCsvCell("ação; \"nome\"\nlinha"), '"ação; ""nome""\nlinha"');
  assert.equal(escapeCsvCell(null), '""'); assert.equal(escapeCsvCell(0), '"0"');
  const csv = serializeCsv(["value", "date"], [["1234.50", "2026-10-06"], [0, "2026-10-06T12:00:00.000Z"]]);
  assert.ok(csv.startsWith("\uFEFF")); assert.ok(csv.includes('"1234.50";"2026-10-06"\r\n'));
});

test("CSV rejects oversized exports and mismatched rows before serialization", () => {
  assert.throws(() => serializeCsv(["value"], Array(MAX_EXPORT_ROWS + 1).fill(["value"])), /ANALYTICS_EXPORT_ROW_LIMIT/);
  assert.throws(() => serializeCsv(["value"], [["one", "two"]]), /ANALYTICS_EXPORT_COLUMNS_MISMATCH/);
});

test("form export failures retain analytical filters and reject external or unrelated return addresses", () => {
  const requestUrl = "https://innove.example.test/api/organizations/org/analytics/exports";
  const scoped = analyticsReturnUrl(new Request(requestUrl, { headers: { referer: "https://innove.example.test/app/analytics?programId=program&year=2026" } }), "limit");
  assert.equal(scoped.pathname, "/app/analytics"); assert.equal(scoped.searchParams.get("programId"), "program"); assert.equal(scoped.searchParams.get("year"), "2026"); assert.equal(scoped.searchParams.get("error"), "limit");
  for (const referer of ["https://external.example.test/app/analytics", "https://innove.example.test/app/analytics-spoof", "https://innove.example.test/login", "malformed"]) {
    const target = analyticsReturnUrl(new Request(requestUrl, { headers: { referer } }), "invalid");
    assert.equal(target.href, "https://innove.example.test/app/analytics?error=invalid");
  }
});

test("report schema rejects unversioned payloads, type substitution, raw rows and floating-point currency", () => {
  const report = cohortReport();
  const parsed = parseAnalyticsReportPayload(report.type, 1, report);
  assert.equal(parsed.type, "COHORT_LONGITUDINAL");
  if (parsed.type === "COHORT_LONGITUDINAL") assert.equal(parsed.cohort.waves[0].metrics[0].sum, "0.60");
  assert.throws(() => parseAnalyticsReportPayload(report.type, 2, report), /ANALYTICS_REPORT_SCHEMA_UNSUPPORTED/);
  assert.throws(() => parseAnalyticsReportPayload("PROGRAM_SUMMARY", 1, report), /ANALYTICS_REPORT_SCHEMA_MISMATCH/);
  assert.equal(analyticsReportPayloadSchema.safeParse({ ...report, rawObservations: [{ observationId: "SECRET", email: "private@example.test" }] }).success, false);
  report.cohort.waves[0].metrics[0].sum = 0.6;
  assert.equal(analyticsReportPayloadSchema.safeParse(report).success, false);
});

test("public payload retains exact allowed aggregates and excludes all institutional identifiers", () => {
  const payload = buildPublicReportPayload(cohortReport(), 5);
  const result = JSON.stringify(payload);
  assert.ok(result.includes("0.60")); assert.ok(result.includes("Receita observada"));
  for (const secret of ["PRIVATE_", "metricId", "cohortId", "programId", "observationId", "venture", "email", "internalNote", "decisionNote"]) assert.equal(result.includes(secret), false, secret);
  assert.equal(publicReportPayloadSchema.safeParse({ ...payload, observationIds: ["SECRET"] }).success, false);
});

test("small samples and complementary coverage cells hide values and all counts in their section", () => {
  const small = buildPublicReportPayload(cohortReport(4), 5);
  assert.deepEqual(small.sections[0].rows, []); assert.deepEqual(small.sections[1].rows, []);
  assert.equal(small.sections[1].suppressed, true);
  const report = cohortReport(10);
  report.cohort.waves[0].coverage.submitted = 9; report.cohort.waves[0].coverage.pending = 1; report.cohort.waves[0].coverage.percentage = 90;
  const payload = buildPublicReportPayload(report, 5);
  assert.deepEqual(payload.sections[0].rows, []); assert.equal(payload.sections[0].suppressed, true);
  assert.throws(() => buildPublicReportPayload(report, 1), /ANALYTICS_PUBLIC_MINIMUM_INVALID/);
});

test("one small enum category suppresses the entire distribution and its counts", () => {
  const report = cohortReport(10);
  report.cohort.waves[0].metrics = [{ ...report.cohort.waves[0].metrics[0], valueType: "ENUM", key: "stage", label: "Estágio", primaryAggregation: "DISTRIBUTION", unit: null, sum: null, mean: null, median: null, minimum: null, maximum: null, validCount: 10, distribution: [{ value: "SMALL_CATEGORY", count: 1 }, { value: "OTHER_CATEGORY", count: 9 }] }];
  const payload = buildPublicReportPayload(report, 5);
  assert.deepEqual(payload.sections[1].rows, []);
  assert.equal(JSON.stringify(payload).includes("SMALL_CATEGORY"), false); assert.equal(JSON.stringify(payload).includes("OTHER_CATEGORY"), false);
  report.cohort.waves[0].metrics[0].distribution = [{ value: "A", count: 5 }, { value: "B", count: 5 }];
  assert.equal(buildPublicReportPayload(report, 5).sections[1].rows.length, 2);
});

test("paired samples and complementary financial contributor counts are suppressed", () => {
  const report = cohortReport(6); const metric = report.cohort.waves[0].metrics[0];
  report.cohort.paired = [{ metricId: metric.metricId, label: metric.label, valueType: "CURRENCY", unit: metric.unit, baselineWaveId: "PRIVATE_WAVE_ID", followUpWaveId: "PRIVATE_FOLLOWUP_ID", pairedCount: 4, baselineAggregate: { ...metric, validCount: 4 }, followUpAggregate: { ...metric, validCount: 4 }, meanAbsoluteChange: "1.00", medianAbsoluteChange: "1.00" }];
  assert.equal(buildPublicReportPayload(report, 5).sections.find((section) => section.title.includes("pareada"))?.suppressed, true);
  const execution: AnalyticsReportPayload = { analyticsSchemaVersion: report.analyticsSchemaVersion, title: report.title, dataAsOf: report.dataAsOf, scope: report.scope, methodology: report.methodology, type: "EXECUTION_SUMMARY", execution: { awards: 6, byStatus: [{ status: "ACTIVE", count: 6 }], requiredObligations: 0, approvedObligations: 0, overdueObligations: 0, pendingReviews: 0, financial: { approved: "600.00", planned: null, paid: "500.00", approvedCount: 6, plannedCount: 0, paidCount: 5 } }, calls: { total: 1, applicationsObserved: 0, submitted: null, withdrawn: null, evaluated: null, selected: null }, programCount: 1 };
  const payload = buildPublicReportPayload(execution, 5);
  assert.deepEqual(payload.sections.find((section) => section.title.includes("financeiro"))?.rows, []);
});

test("paired publication suppresses differences that would reveal excluded individual source values", () => {
  const report = cohortReport(10);
  const baseline = report.cohort.waves[0];
  const metric = baseline.metrics[0];
  metric.validCount = 10; metric.sum = "100.00"; metric.mean = "10.00";
  report.cohort.waves.push({ ...baseline, id: "PRIVATE_FOLLOWUP_ID", name: "Onda final", offsetMonths: 6, sequence: 1, metrics: [{ ...metric }] });
  report.cohort.paired = [{ metricId: metric.metricId, label: metric.label, valueType: "CURRENCY", unit: metric.unit, baselineWaveId: baseline.id, followUpWaveId: "PRIVATE_FOLLOWUP_ID", pairedCount: 9, baselineAggregate: { ...metric, validCount: 9, sum: "90.00" }, followUpAggregate: { ...metric, validCount: 9, sum: "90.00" }, meanAbsoluteChange: "0.00", medianAbsoluteChange: "0.00" }];
  let published = buildPublicReportPayload(report, 5).sections.find((section) => section.title.includes("pareada"))!;
  assert.equal(published.suppressed, true); assert.deepEqual(published.rows, []);
  report.cohort.waves[0].metrics[0].validCount = 9;
  published = buildPublicReportPayload(report, 5).sections.find((section) => section.title.includes("pareada"))!;
  assert.equal(published.suppressed, true);
  report.cohort.waves[1].metrics[0].validCount = 9;
  published = buildPublicReportPayload(report, 5).sections.find((section) => section.title.includes("pareada"))!;
  assert.equal(published.suppressed, false);
});

test("public approval digest is deterministic under property insertion order and changes with approved content", () => {
  const payload = buildPublicReportPayload(cohortReport(), 5);
  const reversed = Object.fromEntries(Object.entries(payload).reverse()) as typeof payload;
  assert.equal(publicPayloadDigest(payload), publicPayloadDigest(reversed));
  assert.notEqual(publicPayloadDigest(payload), publicPayloadDigest({ ...payload, minimumCellSize: 6 }));
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
});

test("nested lifecycle totals and disjoint remainders cannot disclose small application or obligation groups", () => {
  const base = cohortReport();
  const report: Extract<AnalyticsReportPayload, { type: "EXECUTION_SUMMARY" }> = {
    analyticsSchemaVersion: 1, type: "EXECUTION_SUMMARY", title: base.title, dataAsOf: base.dataAsOf, scope: base.scope, methodology: base.methodology, programCount: 5,
    calls: { total: 5, applicationsObserved: 5, submitted: 10, evaluated: 10, selected: 9, withdrawn: 0 },
    execution: { awards: 10, byStatus: [{ status: "ACTIVE", count: 10 }], requiredObligations: 10, approvedObligations: 9, overdueObligations: 0, pendingReviews: 0, financial: { approved: null, planned: null, paid: null, approvedCount: 0, plannedCount: 0, paidCount: 0 } },
  };
  let payload = buildPublicReportPayload(report, 5);
  for (const title of ["Seleção registrada", "Execução institucional", "Situação dos apoios"]) {
    const section = payload.sections.find((entry) => entry.title === title)!;
    assert.equal(section.suppressed, true); assert.deepEqual(section.rows, []);
  }
  report.calls = { total: 5, applicationsObserved: 5, submitted: 16, evaluated: 10, selected: 10, withdrawn: 5 };
  report.execution = { ...report.execution, requiredObligations: 16, approvedObligations: 5, overdueObligations: 5, pendingReviews: 5 };
  payload = buildPublicReportPayload(report, 5);
  assert.equal(payload.sections[0].suppressed, true); assert.equal(payload.sections[1].suppressed, true);
  report.calls = { total: 5, applicationsObserved: 5, submitted: 20, evaluated: 15, selected: 10, withdrawn: 5 };
  report.execution = { ...report.execution, awards: 6, byStatus: [{ status: "ACTIVE", count: 6 }], requiredObligations: 10, approvedObligations: 5, overdueObligations: 0, pendingReviews: 0 };
  payload = buildPublicReportPayload(report, 5);
  assert.equal(payload.sections[0].suppressed, false); assert.equal(payload.sections[1].suppressed, false);
});

test("quality totals hide complementary missingness when one cohort metric is suppressed", () => {
  const base = cohortReport(16);
  const first = base.cohort;
  first.name = "First cohort"; first.waves[0].metrics[0].validCount = 10; first.waves[0].metrics[0].missingCount = 6;
  const second = cohortReport(10).cohort;
  second.id = "SECOND_COHORT"; second.name = "Second cohort"; second.waves[0].metrics[0].validCount = 9; second.waves[0].metrics[0].missingCount = 1;
  const report: AnalyticsReportPayload = {
    analyticsSchemaVersion: 1, type: "DATA_QUALITY", title: base.title, dataAsOf: base.dataAsOf, scope: base.scope, methodology: base.methodology,
    quality: { scope: { programId: null, callId: null, cohortId: null, year: null, metricId: null }, cohorts: [first, second], unmappedIndicators: 0, missingOffsets: 0, ambiguousTimepoints: 0, eligibleWithoutSubmission: 0, submittedWithoutMetricValue: 7, withdrawn: 0 },
  };
  const payload = buildPublicReportPayload(report, 5);
  assert.equal(payload.sections[0].suppressed, true); assert.deepEqual(payload.sections[0].rows, []);
  const visible = payload.sections.find((section) => section.title.startsWith("First cohort") && section.title.endsWith("Receita observada"))!;
  assert.equal(visible.suppressed, false); assert.equal(visible.rows[0][1], 6);
  assert.equal(payload.sections.find((section) => section.title.startsWith("Second cohort") && section.title.endsWith("Receita observada"))?.suppressed, true);
});

test("portfolio monitoring totals hide suppressed component coverage", () => {
  const base = cohortReport(6);
  const second = cohortReport(4).cohort;
  second.id = "SECOND_COHORT"; second.name = "Small cohort";
  const report: AnalyticsReportPayload = {
    analyticsSchemaVersion: 1, type: "PORTFOLIO_EXECUTIVE", title: base.title, dataAsOf: base.dataAsOf, scope: base.scope, methodology: base.methodology,
    portfolio: { scope: { programId: null, callId: null, cohortId: null, year: null, metricId: null }, programs: [], calls: { total: 0, applicationsObserved: 0, submitted: null, evaluated: null, selected: null, withdrawn: null }, execution: { awards: 0, byStatus: [], requiredObligations: 0, approvedObligations: 0, overdueObligations: 0, pendingReviews: 0, financial: { approved: null, planned: null, paid: null, approvedCount: 0, plannedCount: 0, paidCount: 0 } }, cohorts: [base.cohort, second], monitoring: { expected: 10, submitted: 10 }, trackedVentures: 10, milestones: [] },
  };
  const payload = buildPublicReportPayload(report, 5);
  assert.equal(payload.sections[0].suppressed, true); assert.deepEqual(payload.sections[0].rows, []);
});

test("public currency sections retain explicit value type and lossless strings independently of currency unit", () => {
  const decimal = "90071992547409931234567890.12";
  for (const unit of [null, "US$", "USD", "EUR"]) {
    const report = cohortReport(10);
    report.cohort.waves[0].metrics[0] = { ...report.cohort.waves[0].metrics[0], unit, sum: decimal, mean: decimal, median: decimal };
    const payload = buildPublicReportPayload(report, 5);
    const section = payload.sections[1];
    assert.equal(section.valueType, "CURRENCY"); assert.equal(section.rows[0][2], decimal); assert.equal(section.rows[0][3], decimal);
    const untyped = structuredClone(payload) as unknown as { sections: Record<string, unknown>[] };
    delete untyped.sections[1].valueType;
    assert.equal(publicReportPayloadSchema.safeParse(untyped).success, false);
  }
});
