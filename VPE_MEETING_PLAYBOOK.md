# VPE Monthly Meeting Lifecycle & Role Follow-Up Playbook
**NUS Alumni Toastmasters Club · ToastFlow SOP**

NUSA TMC holds monthly Chapter Meetings on the **2nd Friday of each month** (listed in [`index.html`](index.html)).  
To ensure every slot has a confirmed participant and every role holder (especially when **VPE ≠ TME**) knows what to prepare, run VPE inspections and follow-ups along the four-stage monthly cycle below.

---

## 1. Monthly Lifecycle Schedule

### Phase 1 · T-14 Days（会前两周：Speech Slots 与全角色人选统筹）
- **Goal**: Confirm speech slots (3 or 4) and verify every mandatory role has a participant committed.
- **Checklist**:
  1. Check `Prepared Speech 1–4`: confirm whether the meeting runs 3 or 4 speeches; prompt speakers missing Pathways projects or speech titles.
  2. Check core roles: `Toastmaster of the Evening (TME)`, `Sergeant at Arms (SAA)`, `Table Topics Master`, `Timer`, `Ah-Counter` (unless waived for the meeting), `Language Evaluator`, `Speech Evaluator 1–N`.
  3. Fill open slots using ToastFlow recommendations (`scripts/recommend.js`) or invite external **Visiting Toastmasters**.
  4. Verify venue reservation (`SMU SCIS 1 · 80 Stamford Rd` vs `SMU SCIS 2 / SOE · 90 Stamford Rd`), **Meeting Theme**, and SAA assignment in ToastFlow Admin.

### Phase 2 · T-7 Days（会前一周：确认人选 + 下发分角色指南与跟进）
- **Goal**: Once roles are assigned, brief every role holder clearly—especially when **VPE does not serve as TME**—so speakers, guests, Table Topics, and SAA are all aligned before the final Program Sheet is locked.
- **Role-by-Role Briefings**:
  1. **Toastmaster of the Evening (TME)** *(critical when VPE ≠ TME)*:
     - Follow up individually with every **Prepared Speaker** (or coordinate with VPE) to confirm their **exact full name & educational credentials**, **Pathways project & speech title**, and **short Self-Introduction / Bio** for introducing each speaker on stage.
     - Review the meeting agenda timeline (7:30 start, break & Table Topics durations `15` vs `20 min`, target adjournment `9:50` / `9:55`).
  2. **Prepared Speakers (Speech 1–4)**:
     - Send your **Pathways project name**, **speech title**, **duration** (`4–6` or `5–7 min`), and **Self-Introduction** to the **TME**.
     - Confirm AV / slides needs and lock `Confirmed` status in ToastFlow.
  3. **Sergeant at Arms (SAA) & Table Topics Master (TTM)**:
     - Sync the **Meeting Theme** to both **Table Topics Master** and **SAA** well in advance.
     - **SAA Menti / Voting Setup**: In Mentimeter (`Vote for Best Speeches` — Best Prepared Speech, Best Table Topics, Best Evaluator), **update the candidate names, speech/topic prompts (problems/questions), and verify the voting links & QR codes** match the Program Sheet. Note that *Best Table Topics* contenders must be updated live/on-site during or right after the Table Topics segment.
     - **SAA Logistics**: Room setup, 7:30 SAA Ice Breaker (1 min/pax), guest PayNow (`$10`) & Eventbrite QR signage, timer cards/bell.
     - **TTM Preparation**: Design 6–8 theme-linked prompts appropriate for both members and walk-in guests; coordinate with Timer (`1:00 / 1:30 / 2:00`) and pass the actual Table Topics speakers list to SAA right after the segment for voting.
  4. **Visiting Guests & Speech Evaluators**:
     - Send the **Program Sheet** (`.pdf` or standalone `.html` offline snapshot with Page 2 **Project Objectives**, **`⬇ Evaluation form`** download links, and **Location map / Directions**) to every invited guest / visiting evaluator.
     - Confirm each visiting Toastmaster's **Home Club** and **Educational Credentials** so they appear accurately in `data/visiting-toastmasters.json`, `scripts/people.js`, and the left `* Visiting Toastmasters` column.
  5. **Timer & Language Evaluator (& Ah-Counter)**:
     - **Timer**: Confirm timing brackets (Prepared `4–6`/`5–7 min`, Topics `1–2 min`, Evaluations `2–3 min`) and the three Timer's Report stops in the agenda.
     - **Language Evaluator**: Prepare Word of the Day (aligned with Meeting Theme if set), observe grammar/rhetorical highlights, and prepare a 10-minute report.
     - **Ah-Counter**: Confirm whether active or waived for this session; track filler words for a 5-minute report.

### Phase 3 · T-3 ~ T-0 Days（会前终检与正式版 Program Sheet 定稿发布）
- Lock remaining `[TBC]` confirmations in ToastFlow Admin and mark the meeting programme as **Final**.
- Confirm classroom number, `Venue` / `Address` / `Directions` / map image (`80` vs `90 Stamford`), and omit Ah-Counter if waived.
- Export Program Sheet via ToastFlow (`⬇ Word` `.docx` or `💾 Save HTML` / `🖨 PDF`) so all 8 images/QR codes, hyperlinks, and `*` guest markers remain intact; distribute to ExCo, TME, SAA, and Guests.

### Phase 4 · T+3 ~ T+7 Days（会后一周：复盘归档与月度滚动更新）
- Verify actual attendance, actual speech projects completed, and any walk-in/replacement guests from the completed meeting.
- Add any newly appearing visiting Toastmasters or new club members into `data/visiting-toastmasters.json`, `scripts/people.js`, and roster data; verify Google Sheet (`data/appointments-sheet.csv`) & `scripts/meeting-programmes.js` stay in sync.
- Update the upcoming meeting calendar (`meetings` in `index.html`, monthly theme/venue entries) and create/roll forward the next month's VPE Follow-Up tasks.
