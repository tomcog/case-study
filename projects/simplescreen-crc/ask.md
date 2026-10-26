<!-- Pulled from https://docs.google.com/document/d/1aqni773qvcrCaYQKR_h6ykvF-SoIo99mIRxw1OEbGqI/edit?usp=sharing on 2026-10-23T22:40:21.749Z. Edit the Google Doc, not this file: the next pull replaces it. -->

# **Freenome SimpleScreen CRC**

I worked on this project from early 2021 through the end of 2025\. I was the founding designer at Freenome, and the sole designer on this project.

## About Freenome

Freenome is a biotechnology company focused on early cancer detection through non-invasive blood tests (liquid biopsies). Founded in 2014 and based in South San Francisco, California, the company's goal is to catch cancer in its earliest, most treatable stages by making routine screening as accessible as a standard blood draw.

### Core Technology: The Multiomics Platform

Traditional liquid biopsy approaches often search only for rare tumor DNA fragments circulating in the blood. Freenome pairs tumor genomics with the body’s own immune response. Their platform combines:

* Genomics and Epigenomics: Analyzing circulating cell-free DNA (cfDNA) and DNA methylation patterns shed by abnormal cells.  
* Proteomics: Measuring specific protein biomarkers in the blood.  
* Machine Learning & Computational Biology: Training multi-analyte models to identify subtle, complex patterns across thousands of biological signals that distinguish cancer from healthy tissue, even when tumor burden is low.

### Products and Pipeline

* SimpleScreen CRC: An FDA-approved blood test designed to screen average-risk adults aged 45 and older for colorectal cancer. It provides a non-invasive alternative for individuals who avoid or delay routine colonoscopies or stool-based tests.  
* Broader Cancer Pipeline: Freenome is applying its multiomics approach to develop single- and multi-cancer screening tests across other indications, including lung, prostate, and breast cancers.

### End-to-End Diagnostic System

Rather than functioning strictly as a software platform or wet-lab service, Freenome operates an integrated diagnostic ecosystem:

* Physical Device Components: Specialized blood collection kits containing custom tubes, temperature-stabilizing mailers, and regulated Instructions for Use (IFUs) to preserve fragile cell-free DNA during transit.  
* Laboratory Processing: High-throughput CLIA-certified and CAP-accredited facilities that handle automated accessioning, molecular assays, and sequencing.  
* Digital Clinical Infrastructure: Secure, HIPAA-compliant ordering systems, laboratory information management systems (LIMS), and provider portals that deliver clear Test Result Reports and clinical follow-up guidance directly to clinicians.

## About SimpleScreen CRC

SimpleScreen CRC is an FDA-approved, non-invasive blood-based screening test developed by [Freenome](https://www.freenome.com/simplescreen/) to detect colorectal cancer (CRC) in average-risk adults aged 45 and older.

It analyzes circulating cell-free DNA (cfDNA) methylation patterns and molecular biomarkers from a standard peripheral blood draw. The goal is to provide an accessible alternative for the tens of millions of eligible individuals who decline or delay routine stool-based tests (like FIT or Cologuard) or invasive visual exams (colonoscopies).

The complete offering functions as an end-to-end clinical diagnostic system spanning both physical components and a supporting digital ecosystem:

## Physical Components

### Blood collection kit

#### **Description**

A blood collection kit is a self-contained, regulated medical packaging unit designed to facilitate the collection, temporary stabilization, protective packaging, and transport of blood samples from a patient draw site (clinical setting, draw site, or home) to a processing diagnostic laboratory.

Functioning as a physical medical device system, it ensures specimen integrity, biosafety compliance, and chain of custody through four key functional areas:

* **Primary Specimen Containers:**  
  * Dedicated blood collection tubes (BCTs)—typically evacuated glass or plastic tubes tailored to specific assay chemistries.  
  * Preservative or anticoagulant additives (e.g., EDTA, cell-free RNA/DNA BCT stabilizers, serum separator gels) calibrated to prevent clotting, cell lysis, or genomic degradation prior to laboratory processing.  
  * Standardized labeling surfaces for patient identifiers, accession barcodes, and draw timestamps.  
* **Specimen Protection & Secondary Containment:**  
  * Sealable, liquid-tight biohazard specimen bags to isolate the tubes.  
  * Absorbent material sized to capture the full liquid volume of the collected sample in the event of tube fracture or leakage.  
  * Rigid cushioning inserts, thermoformed trays, or cardboard dividers to prevent physical impact damage during handling.  
* **Environmental & Thermal Stabilization:**  
  * Insulated mailers, foil envelopes, or bubble pouches that shield the specimen from external temperature spikes.  
  * Phase-change cooling elements or gel packs designed to maintain required transit stability (e.g., maintaining controlled ambient temperatures between 15°C and 30°C or refrigerated states).  
* **Instructional & Regulatory Labeling:**  
  * An FDA-regulated **Instructions for Use (IFU)** document guiding draw order, fill lines, mandatory tube inversion counts, and packaging sequence.  
  * Kit outer packaging with regulatory labeling, lot numbers, expiration dates, biological substance indicators (e.g., UN 3373 Biological Substance, Category B markings), and pre-addressed return shipping labels.

A 6” x 6” by 2.5” cardboard box, designed by me, with FDA required labeling on the outer surfaces. Inside it contains two glass blood collection tubes (BCT) for the patient’s specimen, a printed booklet called Instructions for Use (IFU) which is part of the required FDA labeling, and various components to protect the patient sample for shipment back to Freenome’s lab (insulated enveloped, gel pack for maintaining ambient temperature in the box during shipping, specimen bag).

#### **Artifacts**

1. 3D renderings of box exterior from various angles, including mock up of all the required FDA labeling  
2. 3D renderings of glass blood collection tubes, with FDA-compliant patient info label on it

### Test Requisition form (TRF)

#### **Description**

Designed by me in parallel with the online order form in the Provider Portal, the Test Requisition Form is printed paper form, also available as a downloadable PDF, that providers can use who do not have access to digital methods of ordering. Providers would typically fill out the form by hand, then fax it back to Freenome. Alternatively, they might download the PDF, fill it out “online”, then print and/or fax it. They could also fill out the paper TRF and then place it into the blood collection kit and ship it back to Freenome along with the patient’s specimen.

#### **Artifacts**

1. Mock ups of the TRF, can be represented both as a physical piece of paper, or as a PDF

### Instructions for Use (IFU)

#### **Description**

Designed entirely by me, including art direction for professional custom illustrations, the **Instructions for Use (IFU)** is an officially regulated document—typically a printed foldout, booklet, or card—that provides step-by-step guidance on how to properly collect, handle, package, and return a specimen.

Under FDA regulations (and international IVD standards), an IFU is legally classified as part of the medical device’s labeling. It ensures both sample integrity (so the diagnostic test produces a valid, accurate result) and user safety.

Depending on whether the blood collection kit is intended for a healthcare professional (phlebotomist/clinic staff) or for self-collection/at-home use, the IFU typically covers:

* **Kit Inventory & Verification:** A visual checklist of everything included in the box (e.g., blood collection tubes, biohazard bag, desiccant/gel packs, return mailer) and warnings to verify expiry dates or inspect for damaged components before proceeding.  
* **Preparation & Pre-Collection Requirements:** Patient instructions prior to the draw (such as fasting requirements, hydration, or timing restrictions) and workplace prep (glove use, surface sanitization).  
* **Sample Collection Procedure:**  
  * *For professional venipuncture kits:* Correct draw order, tube filling volume, and specific inversion counts (e.g., gently inverting the tube 8–10 times immediately after collection to mix the blood with preservatives or anticoagulants without causing hemolysis).  
  * *For capillary/fingerstick kits:* Warming hands, lancet use, wiping away the first drop, filling microtainers to the fill line, and bandaging.  
* **Labeling Instructions:** Explicit directions on how and where to apply patient identification labels (e.g., writing the draw date/time, patient name, or matching barcode stickers from the requisition form directly onto the collection tubes).  
* **Packaging & Biospecimen Protection:** Step-by-step instructions for placing tubes into secondary packaging (specimen bags with absorbent pads), inserting temperature-stabilizing elements (gel packs, insulated liners), and sealing the outer shipping container.  
* **Storage & Shipping Timelines:** Temperature hold requirements (ambient vs. refrigerated) and cutoff times for dispatching the sample to the processing laboratory (e.g., "ship within 24 hours of collection").  
* **Warnings, Precautions & Disclaimers:** Regulatory contraindications, biosafety/biohazard handling warnings, disposal instructions, and laboratory customer support contact details.

#### **Artifacts**

1. Mockups (from original design files) of the full 8-panel layout (4 panels, both sides).  
2. 3D rendering \- including animation showing how it folds/unfolds

### Test Result Report

#### **Description**

Designed by me after hours of consultation and feedback from providers, and in strict accordance with CLIA and FDA regulatory specifications, the **Test Result Report** is the official clinical document generated by an accredited diagnostic laboratory (e.g., CLIA-certified/CAP-accredited) that communicates the qualitative or quantitative findings of a blood test to ordering healthcare providers and patients.

Physicians consulted on both the visual layout as well as the language to ensure it was accurate and appropriate, as well as Freenome’sx own medical, legal, and regulatory experts.

Beyond simply displaying a finding, it serves as a formal medical and legal record that synthesizes patient identification, specimen integrity, diagnostic metrics, and clinical guidance.

Key sections and core components include:

* **Patient & Specimen Identifiers:** Full patient legal name, date of birth, unique Medical Record Number (MRN), laboratory accession/requisition number, collection date and time, and the date/time the sample was received and reported by the lab.  
* **Ordering Provider Information:** Name, National Provider Identifier (NPI), clinic/hospital system, and contact details of the clinician who authorized the test.  
* **Specimen Quality & Validity:** Notes on sample condition upon receipt (e.g., adequate volume, absence of severe hemolysis or lipemia) and confirmation of test validity.  
* **Primary Result & Interpretation:**  
  * *Qualitative / Binary Assays (e.g., screening tests):* A clear determination such as "Detected / Not Detected," "Positive / Negative," or "Abnormal / Normal," usually accompanied by high-level clinical interpretation text.  
  * *Quantitative Assays (e.g., comprehensive metabolic panels, biomarker levels):* Numerical values, units of measurement (e.g., mg/dL, ng/mL), and standard reference ranges or cutoffs indicating low, normal, or high flags.  
* **Clinical Next Steps & Guidance:** Standardized clinical guidance detailing the implications of the finding (e.g., recommending confirmatory diagnostic workups, reflex testing, or a follow-up colonoscopy/imaging if a screening marker is elevated).  
* **Test Limitations & Performance Characteristics:** Regulatory disclosures describing assay sensitivity, specificity, positive/negative predictive value limits, and explicit statements regarding factors that may cause false positives or false negatives.  
* **Laboratory Credentials & Sign-off:** Lab facility name, address, CLIA/CAP certification IDs, and the digital signature or name of the Medical Director / Pathologist responsible for certifying the results.  
* Immutable audit log detailing each change to, version of the result report

#### **Artifacts**

1. Mocks of the various versions of the report, for negative, positive, and no result  
2. Also gets presented in the provider portal and order manager, as PDFs that can be viewed online or downloaded for printing, sharing.

## The Digital Ecosystem

The SimpleScreen CRC digital ecosystem consists of 4 user-facing applications and a dozen or so backend systems that enable the end-to-end user journeys that make up the SimpleScreen CRC lifecycle. Orders to Result (no payment at this stage, as the apps were initially designed to support an early access period (EAP) where the tests were performed for actual patients but at no-charge.

#### **Artifacts**

For all applications, both static screenshots and fully functional prototypes that the viewer can interact with are available.

### Provider Portal

A web interface enabling physicians and clinic staff to electronically order tests, track sample shipment status, view patient lists, and securely retrieve completed Test Result Reports

While large healthcare systems often order SimpleScreen directly through their Electronic Health Records (EHR), that level of integration is expensive and complex. The Provider Portal was designed to fill that gap for smaller institutions. It gives these providers a dedicated, standalone tool to identify eligible patients, place orders, and manage the process. It offers full visibility \- tracking the sample from shipment to the lab \- and provides instant access to the final result reports, which can be viewed online or downloaded to share with patients.

1. It’s the starting point for the SimpleScreen journey, when a provider identifies a patient who is eligible for it and orders it.  
2. If the provider’s institution’s EHR system is integrated with Freenome, they will be able to order it through the EHR. But for those that don’t, which is many particularly smaller institutions because integration is expensive and complicated, they need to use the Provider Portal.  
3. The Portal displays all orders placed by that provider, regardless of how they are submitted.  
4. The Portal is where the provider will receive the test result report, both viewable online and downloadable as a PDF they can share with the patient.  
5. It shows the progress of a test from the moment it’s shipped until the result is available.  
6. Providers can make changes to an order, and cancel an order.

### Accessioning

The operational software system inside the diagnostic laboratory used to intake incoming specimen boxes, scan tube barcodes, verify sample volume and stability, reconcile digital orders against physical TRFs, and route batches to automated molecular assay lines.

Accessioning is the application used by Freenome lab staff to link the patient’s blood sample that has been shipped to the lab with an order placed by the provider.

1. When the blood collection kit arrives, its barcode is scanned along with the barcodes on the blood collection tubes.   
2. Patient identifiers are verified, which are required.   
3. Any missing or mismatched information is documented, and holds are placed on the specimen if needed.  
4. Using the patient information provided in the kit, the user searches for matching orders in the system, and links them when a match is found. That all happens in what they call the “dry lab”  
5. The blood sample then moves into the “wet lab” where it is prepared for testing.

Once a blood collection kit arrives at the lab, the intake process begins using an application called Accessioning. The kit components are scanned, any anomalies with the sample that could affect the test are documented (and put on hold when appropriate) before being matched to an order in Freenome’s system.

### TRF Queue

An application for creating digital orders for tests that were originally submitted as either faxed TRFs, or printed TRFs that were shipped to Freenome  in the blood collection kit along with the patient sample.

For old school providers, there’s a TRF that can be faxed or printed and returned along with the patient’s sample in the blood collection kit shipped to Freenome’s lab in SF. These “paper” orders must be turned into digital ones so they can be properly tracked  throughout the lab, and beyond. The tool for this job is the TRF Queue. Faxes are routed as PDFs to a unified mailbox in the Queue, while paper TRFs are scanned on-site and also end up in the Queue. The info is transcribed into a digital order form, verified, and saved so that it can be matched to incoming patient samples.

### Order Manager

Internal tool used primarily by customer support, giving visibility into all orders in the system. Here they may be updated with changes to patient information, the status can be checked, results can be obtained and tests can be re-ordered and results re-generated.

1. It shows all active orders  
2. Active orders can be modified or canceled  
3. Specimen holds, which are applied during accessioning, can be released using Order Manager  
4. Additional holds can be applied if necessary.  
5. It integrates with Salesforce for more robust tracking of order issues.  
6. All completed orders can also be viewed here.  
7. If necessary to retest, because of a problem with a sample or other issue in the lab that invalidates the result, Order Manager can be used to generate a new order.  
8. Test result reports can be regenerated, and then sent to the Portal or faxed directly to providers.

## Privacy Regulations

Privacy regulations like GDPR, CCPA, and especially HIPAA (Health Insurance Portability and Accountability Act) fundamentally shift software design from "build for convenience and speed" to "build around data governance, verification, and defense."

Under HIPAA, any Protected Health Information (PHI)—which includes names, dates, phone numbers, test results, or even an IP address tied to medical data—must be protected through administrative, physical, and technical safeguards.

Here is how those requirements shape both front-end and back-end software design:

### **Front-End & UI/UX Design**

The front end is treated as a hostile, untrusted environment. Because client-side code runs on user devices in unpredictable surroundings, compliance mandates strict controls over what is visible, cached, and transmitted.

* **Session Expiration and Auto-Logout:**  
* Inactivity timers (often 10–15 minutes) automatically invalidate sessions and clear screen contents.  
* Re-authentication modals or screen-masking overlays prevent sensitive clinical data from lingering on shared terminals or left-open laptops.  
* **Client-Side State & Storage Restrictions:**  
* Sensitive data (PHI) is kept out of persistent browser storage (`localStorage`, `sessionStorage`, or unencrypted IndexedDB) because those mechanisms persist across tabs and are vulnerable to cross-site scripting (XSS) or physical device access.  
* State management systems (like Redux, Zustand, or Vuex) must flush patient state on logout or token expiration.  
* **Elimination of Third-Party Trackers and Analytics:**  
* Mainstream analytics, conversion pixels, and session replay scripts (e.g., standard Google Analytics, Meta Pixel, FullStory) cannot run on pages or views that handle patient data unless the vendor signs a formal Business Associate Agreement (BAA) and scrubs URL parameters and input fields.  
* URL structures must avoid carrying PHI in query parameters (e.g., `/patient?id=123&condition=cancer`), as browser histories, proxies, and web-server access logs record full URLs in plain text.  
* **UI Data Masking & Role-Based Views:**  
* Screens apply field-level masking (e.g., showing only the last four digits of identifiers or masking clinical notes until explicitly unhidden) to comply with HIPAA's **Minimum Necessary Rule**.  
* Form inputs disable browser autofill/autocomplete where sensitive health attributes or identifiers are entered.

### **Back-End & Infrastructure Design**

The back end bears the core legal responsibility for data integrity, encryption, access control, and defensible auditability.

* **Strict Authentication & Authorization (RBAC / ABAC):**  
* Every API request independently verifies identity and permissions at the endpoint level; client-side checks are never relied upon.  
* **Role-Based or Attribute-Based Access Control:** Systems differentiate between a patient, billing coordinator, phlebotomist, or ordering physician. A user receives access strictly to the data elements necessary to perform their job (e.g., a billing clerk sees insurance and billing codes, but not lab assay curves or genomic markers).  
* Multi-Factor Authentication (MFA) is standard across internal portals and privileged access paths.  
* **Encryption at Rest and in Transit:**  
* **In Transit:** Mandatory TLS 1.2 or 1.3 across all network hops, with insecure ciphers disabled and HTTP Strict Transport Security (HSTS) enforced. Internal service-to-service communication within a cluster or VPC uses mutual TLS (mTLS) or encrypted private overlays.  
* **At Rest:** Database volumes, object storage buckets (S3, GCS), temporary queues, and database backups are encrypted with AES-256. High-risk systems often employ application-level or field-level envelope encryption for specific PHI columns, meaning data remains ciphertext even to an unauthorized database administrator.  
* **Immutable Audit Logging (Read, Write, and Export):**  
* Normal web apps log errors and writes. HIPAA requires logging **reads** of PHI as well: *Who* accessed *which* record, *when*, from *where*, and *what action* was taken.  
* Logs must be tamper-proof (write-once/append-only storage) and retained for multi-year compliance windows (often 6 years under HIPAA).  
* **Log Sanitization:** Application-level logger configurations must explicitly strip PHI from standard stdout/debug logging, ensuring patient details don't leak into Datadog, CloudWatch, or Splunk.  
* **Vendor Ecosystem & Business Associate Agreements (BAAs):**  
* Every infrastructure provider, transactional email service (SendGrid, Postmark), SMS provider (Twilio), queue runner, and cloud host (AWS, GCP, Azure) must execute a BAA before handling any traffic or data.  
* Services incapable or unwilling to sign a BAA cannot be introduced into data pipelines that process PHI.  
* **Data Lifecycle, Retention, and Disposal:**  
* Mechanisms must be in place to purge, de-identify, or archive data according to statutory timelines, balanced against patient data access rights and laboratory record retention rules (e.g., CLIA rules requiring diagnostic records to be kept for specific multi-year periods).
