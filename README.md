# AcadFill - Academic Admission Autofill Chrome Extension

> Automatically fill academic admission forms with your saved profile. Supports multiple candidates, dynamic qualification levels, and research publications.

---

## ✨ Features

- **Multi-Candidate Profiles** — Store and switch between multiple applicants
- **Comprehensive Personal Info** — Name, DOB, gender, category, identity docs, permanent & correspondence address
- **Flexible Academic Qualifications** — Add any level (10th, 12th, Diploma, UG, PG, M.Phil, PhD, Post-Doc, or custom) with subject-wise marks
- **Research Publications** — Journal, conference, book chapter, patents with full bibliographic details
- **Intelligent Autofill Engine** — Analyzes form fields by label, `aria-label`, placeholder, `name`, and `id` attributes
- **Floating Fill Button** — Appears on academic portals for one-click autofill
- **Fill Report Panel** — Shows which fields were filled vs. skipped
- **Highlight Filled Fields** — Visual feedback with animated highlight
- **Import / Export Data** — Backup and restore profiles as JSON
- **React / Angular Support** — Triggers synthetic events for modern web frameworks

---

## 📦 Project Structure

```
academic-autofill-chrome-extension/
├── manifest.json               # Chrome Extension Manifest v3
├── background/
│   └── background.js           # Service worker, context menus, badges
├── content/
│   ├── content.js              # Autofill engine + floating button
│   └── content.css             # Floating button & report panel styles
├── popup/
│   ├── popup.html              # Extension popup UI
│   ├── popup.css               # Popup styles (light theme, Inter font)
│   └── popup.js                # Popup controller (all views)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🚀 Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the root folder of this project
5. The **AcadFill** extension icon will appear in your toolbar

---

## 🔧 How to Use

### 1. Set Up Your Profile
- Click the AcadFill icon in the Chrome toolbar
- Click **"+"** to create a new candidate profile
- Fill in your **Personal Info** (name, DOB, address, identity docs, etc.)
- Add your **Academic Qualifications** with subject-wise marks
- Add any **Publications / Research Papers**
- Click **Save** in each section

### 2. Switch Candidates
- Use the dropdown at the top to switch between multiple profiles
- The active profile is used for autofill

### 3. Autofill a Form
- Navigate to any academic admission portal
- A floating **AcadFill** button will appear in the bottom-right corner
- Click it to autofill the form automatically
- A report panel shows filled/skipped fields

### 4. Manual Trigger
- Click the extension popup → **"Autofill Now"** button
- Or right-click the page → **AcadFill: Autofill this page**

### 5. Fields You Fill Manually
Some fields require manual selection as they are application-specific:
- Application Type / Program
- Department / Course selection
- Priority / Preference order
- Payment / Fee details
- Captcha / OTP fields

---

## 🎓 Supported Qualification Levels

| Level | Mapped Patterns |
|-------|----------------|
| 10th / SSC | Secondary, Matriculation, Class 10 |
| 12th / HSC | Higher Secondary, Intermediate, Plus Two, PUC |
| Diploma | Polytechnic |
| UG | Bachelor's (B.Tech, B.E., B.Sc, B.Com, B.A.) |
| PG | Master's (M.Tech, M.E., M.Sc, M.Com, M.A.) |
| M.Phil | M.Phil |
| PhD | Doctorate, D.Phil |
| Post-Doc | Post-Doctoral |
| **Custom** | Any user-defined level name |

---

## 🔐 Privacy

- All data is stored **locally** in Chrome's `storage.local` — never sent to any server
- Export your data as JSON anytime for backup
- Delete individual profiles or clear all data from Settings

---

## 🛠 Technologies

- Chrome Extension Manifest **V3**
- Vanilla **HTML / CSS / JavaScript** (no frameworks)
- Chrome APIs: `storage`, `scripting`, `activeTab`, `contextMenus`, `tabs`
- Google Fonts: **Inter**

---

## 📄 License

MIT License — free to use and modify.