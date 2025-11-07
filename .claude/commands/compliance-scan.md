Run a comprehensive compliance audit for SOC2, HIPAA, GDPR, or PCI-DSS frameworks.

## Instructions

Execute a compliance scan based on the specified framework (or all if not specified).

### Arguments

Framework selection (optional): $1

Valid frameworks:
- `soc2` - SOC2 Type II compliance
- `hipaa` - HIPAA (Health Insurance Portability and Accountability Act)
- `gdpr` - GDPR (General Data Protection Regulation)
- `pci` or `pci-dss` - PCI-DSS (Payment Card Industry Data Security Standard)
- `all` - Run all compliance scans (default if no argument)

## What This Does

1. Identifies applicable compliance framework(s)
2. Scans codebase for compliance violations
3. Checks infrastructure configuration
4. Reviews security controls
5. Generates compliance report with findings
6. Provides remediation recommendations

## Scan Components

### SOC2 Type II Scan

```bash
# Security Controls
- Access control validation
- Authentication mechanisms
- Authorization rules
- Encryption at rest
- Encryption in transit
- Audit logging
- Change management
- Incident response procedures
- Data backup and recovery
- Monitoring and alerting

# Scan Commands
grep -r "TODO" . | grep -i "security"
find . -name "*.env" -o -name "*.pem" -o -name "*.key"
grep -r "password\s*=\s*['\"]" .
# Check for hardcoded secrets
```

### HIPAA Scan

```bash
# PHI Protection
- Detect PHI in code/logs
- Encryption validation
- Access controls for PHI
- Audit trails
- Business Associate Agreements
- Breach notification procedures
- Minimum necessary standard
- Data retention policies

# Scan Patterns
# Look for common PHI fields
grep -ri "ssn\|social.security\|date.of.birth\|dob\|medical.record\|diagnosis\|prescription" .
grep -ri "patient.name\|patient.id\|medical.record.number" .
# Check encryption
grep -ri "encrypt" . | grep -v "encrypted"
```

### GDPR Scan

```bash
# Data Protection
- PII identification
- Consent management
- Data subject rights (access, erasure, portability)
- Data retention policies
- Cross-border data transfers
- Privacy by design
- Data Protection Impact Assessment (DPIA)
- Cookie consent

# Scan Patterns
grep -ri "personal.data\|pii\|personally.identifiable" .
grep -ri "email\|phone\|address\|birthdate" . | grep -v ".git" | grep -v "node_modules"
# Check for GDPR-required features
grep -ri "consent\|right.to.erasure\|data.portability" .
```

### PCI-DSS Scan

```bash
# Cardholder Data Protection
- Detect credit card numbers
- Encryption of cardholder data
- Network segmentation
- Access controls
- Secure authentication
- Regular security testing
- Security policy
- Vulnerability management

# Scan Patterns
# Credit card number patterns (intentionally conservative)
grep -rE "[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}[- ]?[0-9]{4}" .
grep -ri "card.number\|cvv\|card.holder\|expiry" .
# Check for PCI DSS controls
grep -ri "encrypt\|tokenize\|mask" . | grep -i "card\|payment"
```

## Implementation

```bash
#!/bin/bash

framework="${1:-all}"

case "$framework" in
  soc2)
    echo "🔍 Running SOC2 Type II Compliance Scan..."
    run_soc2_scan
    ;;
  hipaa)
    echo "🏥 Running HIPAA Compliance Scan..."
    run_hipaa_scan
    ;;
  gdpr)
    echo "🇪🇺 Running GDPR Compliance Scan..."
    run_gdpr_scan
    ;;
  pci|pci-dss)
    echo "💳 Running PCI-DSS Compliance Scan..."
    run_pci_scan
    ;;
  all)
    echo "🔍 Running All Compliance Scans..."
    run_soc2_scan
    run_hipaa_scan
    run_gdpr_scan
    run_pci_scan
    ;;
  *)
    echo "❌ Unknown framework: $framework"
    echo "Valid options: soc2, hipaa, gdpr, pci, all"
    exit 1
    ;;
esac
```

## Output Format

Generate a comprehensive compliance report:

```markdown
# Compliance Scan Report

**Date:** 2025-11-01 14:30:00 UTC
**Framework(s):** SOC2, HIPAA, GDPR, PCI-DSS
**Scan Duration:** 45 seconds

---

## Executive Summary

**Overall Compliance Score:** 78/100 (🟨 Needs Improvement)

| Framework | Score | Status | Critical Issues |
|-----------|-------|--------|-----------------|
| SOC2 | 85/100 | 🟩 Good | 2 |
| HIPAA | 72/100 | 🟨 Fair | 5 |
| GDPR | 80/100 | 🟩 Good | 3 |
| PCI-DSS | 65/100 | 🟥 Needs Work | 8 |

---

## Critical Findings

### 🔴 HIGH SEVERITY (18 issues)

1. **[HIPAA] PHI Exposure in Logs**
   - Location: `src/services/patient-service.ts:45`
   - Issue: Patient name logged without encryption
   - Impact: PHI data breach risk
   - Remediation: Remove PHI from logs or encrypt
   - Priority: IMMEDIATE

2. **[PCI-DSS] Potential Card Number in Code**
   - Location: `src/utils/payment.ts:123`
   - Issue: Credit card regex pattern without masking
   - Impact: Cardholder data exposure
   - Remediation: Implement tokenization
   - Priority: IMMEDIATE

3. **[SOC2] Hardcoded Credentials**
   - Location: `config/database.ts:12`
   - Issue: Database password in source code
   - Impact: Unauthorized access risk
   - Remediation: Use environment variables
   - Priority: IMMEDIATE

### 🟡 MEDIUM SEVERITY (35 issues)

4. **[GDPR] Missing Consent Management**
   - Location: `src/components/signup.tsx`
   - Issue: No explicit consent for data collection
   - Impact: GDPR Article 7 violation
   - Remediation: Implement consent checkbox
   - Priority: HIGH

5. **[SOC2] Insufficient Audit Logging**
   - Location: `src/api/user-controller.ts`
   - Issue: User actions not logged
   - Impact: Audit trail gaps
   - Remediation: Add comprehensive logging
   - Priority: MEDIUM

### 🟢 LOW SEVERITY (47 issues)

6. **[HIPAA] Data Retention Policy Missing**
   - Location: Documentation
   - Issue: No documented retention policy
   - Impact: Compliance documentation gap
   - Remediation: Create policy document
   - Priority: LOW

---

## Detailed Findings by Framework

### SOC2 Type II (Score: 85/100)

**Passed Controls (17/20):**
- ✅ Encryption in transit (TLS 1.2+)
- ✅ Authentication (MFA enabled)
- ✅ Authorization (RBAC implemented)
- ✅ Monitoring (Prometheus + Grafana)
- ✅ Incident response procedures documented
- ✅ Change management via Git
- ✅ Data backup automated
- ✅ Disaster recovery plan exists
- ✅ Security awareness training
- ✅ Vendor management
- ✅ Network security (firewall rules)
- ✅ Vulnerability scanning (weekly)
- ✅ Penetration testing (annual)
- ✅ Risk assessment (quarterly)
- ✅ Business continuity plan
- ✅ Physical security controls
- ✅ Environmental controls

**Failed Controls (3/20):**
- ❌ Hardcoded credentials found (2 instances)
- ❌ Incomplete audit logging in payment service
- ❌ Missing encryption at rest for user uploads

**Recommendations:**
1. Remove all hardcoded credentials within 48 hours
2. Implement comprehensive audit logging
3. Enable encryption at rest for all user data
4. Review access control matrix monthly

---

### HIPAA (Score: 72/100)

**Compliant Areas:**
- ✅ Administrative safeguards
- ✅ Technical safeguards (partial)
- ✅ Encryption in transit
- ✅ Access controls

**Non-Compliant Areas:**
- ❌ PHI exposure in application logs (5 instances)
- ❌ Missing audit trail for PHI access
- ❌ Insufficient encryption at rest
- ❌ No documented breach notification procedure
- ❌ Business Associate Agreements not templated

**Critical Actions Required:**
1. **IMMEDIATE:** Sanitize all PHI from logs
2. **HIGH:** Implement audit trail for all PHI access
3. **HIGH:** Enable encryption at rest for PHI
4. **MEDIUM:** Create breach notification runbook
5. **MEDIUM:** Template BAA for vendors

**HIPAA Risk Assessment:**
- **Privacy Rule:** 🟨 Moderate Risk
- **Security Rule:** 🟥 High Risk
- **Breach Notification:** 🟨 Moderate Risk
- **Enforcement:** 🟩 Low Risk

---

### GDPR (Score: 80/100)

**Compliant Articles:**
- ✅ Article 5: Principles (transparency, purpose limitation)
- ✅ Article 15: Right to access
- ✅ Article 20: Data portability
- ✅ Article 25: Privacy by design
- ✅ Article 32: Security of processing

**Non-Compliant Articles:**
- ❌ Article 7: Consent (3 signup flows missing explicit consent)
- ❌ Article 17: Right to erasure (not fully implemented)
- ❌ Article 30: Records of processing (documentation incomplete)

**Data Subject Rights Implementation:**
- ✅ Right to Access: Implemented
- ✅ Right to Portability: Implemented
- ⚠️ Right to Erasure: Partially implemented
- ❌ Right to Restriction: Not implemented
- ✅ Right to Rectification: Implemented
- ⚠️ Right to Object: Partially implemented

**Recommendations:**
1. Add explicit consent checkboxes to all signup flows
2. Complete right to erasure implementation
3. Implement right to restriction of processing
4. Update Records of Processing Activities (ROPA)
5. Conduct Data Protection Impact Assessment (DPIA)

---

### PCI-DSS (Score: 65/100)

**Requirements Status:**

| Requirement | Status | Notes |
|-------------|--------|-------|
| 1. Firewall Configuration | ✅ Pass | AWS Security Groups configured |
| 2. Default Passwords | ✅ Pass | No default credentials |
| 3. Cardholder Data Protection | ❌ Fail | Potential exposure in code |
| 4. Encrypted Transmission | ✅ Pass | TLS 1.2+ enforced |
| 5. Anti-virus | ✅ Pass | AWS GuardDuty enabled |
| 6. Secure Systems | ⚠️ Partial | Some patches pending |
| 7. Access Control | ✅ Pass | RBAC implemented |
| 8. Unique IDs | ✅ Pass | Individual user accounts |
| 9. Physical Access | N/A | Cloud-based |
| 10. Monitoring | ⚠️ Partial | Need cardholder data access logs |
| 11. Security Testing | ⚠️ Partial | Quarterly scans needed |
| 12. Security Policy | ✅ Pass | Policy documented |

**Critical PCI Gaps:**
1. **Requirement 3:** Tokenize all card data immediately
2. **Requirement 6:** Patch remaining vulnerabilities
3. **Requirement 10:** Enhance logging for card data access
4. **Requirement 11:** Schedule quarterly vulnerability scans

**SAQ (Self-Assessment Questionnaire):**
- Recommended SAQ Type: **SAQ A-EP** (E-commerce)
- Estimated Completion: 2-3 weeks with remediation

---

## Remediation Plan

### Phase 1: Immediate (0-7 days)

**Critical Security Issues:**
- [ ] Remove hardcoded credentials (2 instances)
- [ ] Sanitize PHI from logs (5 locations)
- [ ] Implement card data tokenization
- [ ] Enable encryption at rest for user data

**Estimated Effort:** 40 hours
**Risk Reduction:** 60%

### Phase 2: High Priority (1-4 weeks)

**Compliance Gaps:**
- [ ] Implement comprehensive audit logging
- [ ] Add GDPR consent management
- [ ] Complete right to erasure feature
- [ ] Create breach notification runbook
- [ ] Template Business Associate Agreements

**Estimated Effort:** 120 hours
**Risk Reduction:** 85%

### Phase 3: Medium Priority (1-3 months)

**Process & Documentation:**
- [ ] Update Records of Processing Activities
- [ ] Conduct Data Protection Impact Assessment
- [ ] Implement right to restriction
- [ ] Document data retention policies
- [ ] Schedule quarterly vulnerability scans

**Estimated Effort:** 80 hours
**Risk Reduction:** 95%

---

## Continuous Compliance

### Automated Monitoring

```bash
# Add to CI/CD pipeline
- name: Compliance Scan
  run: /compliance-scan all
  schedule: "0 0 * * 0"  # Weekly

# Pre-commit hooks
pre-commit:
  - secret-scan
  - pii-detection
  - license-check
```

### Quarterly Reviews
- [ ] Review access controls
- [ ] Update risk assessments
- [ ] Test incident response
- [ ] Review vendor compliance
- [ ] Update documentation

### Annual Activities
- [ ] Penetration testing
- [ ] Security awareness training
- [ ] Policy updates
- [ ] External audit (SOC2)
- [ ] Compliance certification renewal

---

## Resources

### SOC2
- [AICPA Trust Services Criteria](https://www.aicpa.org)
- [SOC2 Academy](https://soc2.academy)

### HIPAA
- [HHS HIPAA Portal](https://www.hhs.gov/hipaa)
- [HIPAA Journal](https://www.hipaajournal.com)

### GDPR
- [GDPR.eu](https://gdpr.eu)
- [ICO Guidance](https://ico.org.uk/for-organisations/guide-to-data-protection/guide-to-the-general-data-protection-regulation-gdpr/)

### PCI-DSS
- [PCI Security Standards](https://www.pcisecuritystandards.org)
- [PCI DSS Quick Reference](https://www.pcisecuritystandards.org/document_library)

---

**Report Generated:** 2025-11-01 14:30:45 UTC
**Next Scan:** 2025-11-08 00:00:00 UTC (Automated Weekly)
**Contact:** compliance@company.com
```

## Notes

**Important:**
- This is an automated scan - not a substitute for professional audit
- Consult with compliance experts for official certification
- Some checks require manual verification
- Keep scan results confidential

**Follow-up Actions:**
1. Review all findings with security team
2. Prioritize remediation based on risk
3. Schedule follow-up scan after fixes
4. Document all remediation efforts
5. Update compliance documentation

**Integration:**
- Can be run in CI/CD pipeline
- Generates reports for auditors
- Tracks compliance over time
- Alerts on new violations
