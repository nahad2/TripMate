# ✈️ TripMate
### Group Trip Planning & Expense Management Platform

<p align="center">
  <b>Plan Together. Travel Together. Manage Money Transparently.</b>
</p>

TripMate is a web-based group trip planning and expense management platform that helps friends organize trips, manage shared budgets, track contributions, split expenses fairly, and settle payments transparently.

It provides a centralized workspace where trip members can collaborate, manage financial activities, and keep all important trip information organized.

---

## 🌟 Key Features

- **Trip Management** – Create trips, explore public trips, invite members, and manage trip details.
- **User Authentication** – Secure registration, login, and account management.
- **Role-Based Access Control** – Separate permissions for Owners, Admins, Members, and Visitors.
- **Budget Management** – Monitor estimated budgets, contributions, expenses, and available funds.
- **Contribution Tracking** – Support partial contributions, multiple payments, and additional deposits.
- **Expense Management** – Submit, review, approve, and track trip expenses.
- **Flexible Expense Splitting** – Equal, custom, individual, and participation-based expense sharing.
- **Personal Payments** – Track expenses paid personally by members.
- **Reimbursement Management** – Calculate and monitor outstanding reimbursements.
- **Central Group Fund** – Track group money and financial transactions.
- **TripMate Notepad** – Separate General Notes and Expense Notes.
- **Admin Panel** – Manage members, permissions, contributions, and expense approvals.
- **Announcements & Notifications** – Keep members informed about important updates.
- **Trip Schedule Planner** – Organize activities, dates, times, and locations.
- **Final Settlement** – Calculate member-wise balances and suggested payments.
- **Reports & Activity Logs** – Maintain financial records and track important actions.

## 🛠️ Technology Stack

| Category | Technology |
|---|---|
| Frontend | React |
| Programming Language | TypeScript |
| Styling | Tailwind CSS |
| Build Tool | Vite |
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| AI Integration | Google Gemini API |
| Icons | Lucide React |
| Package Manager | npm / Bun |

## 📂 Project Structure

```text
TripMate/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── server/
│   └── ...
│
├── index.html
├── server.ts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── .gitignore
└── README.md
```

*The directory structure may evolve as development continues.*

## ⚙️ Getting Started

Follow these steps to run TripMate locally.

### Prerequisites

Make sure you have installed:

- [Node.js](https://nodejs.org/)
- npm (included with Node.js)
- [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/nahad2/TripMate.git
```

### 2. Navigate to the Project Directory

```bash
cd TripMate
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file from the example:

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux:**
```bash
cp .env.example .env
```

Add your required environment variables and configure your Gemini API key using [Google AI Studio](https://aistudio.google.com/).

Never commit your actual API keys or other secrets to GitHub.

### 5. Start the Development Server

```bash
npm run dev
```

Open your browser and visit:

```text
http://localhost:3000
```

### 6. Build for Production

```bash
npm run build
```

### 7. Run TypeScript Checks

```bash
npm run lint
```

## 💰 Financial Management

TripMate focuses on transparent and accurate group expense management.

Its financial system is designed to handle:

- Partial and multiple contributions.
- Expenses paid from the central group fund.
- Expenses paid personally by members.
- Participant-based expense distribution.
- Partial reimbursements.
- Member-wise financial balances.
- Final trip settlement.

**Core Principle:** Every expense should be recorded once, and every contribution or reimbursement should be traceable.

## 🎯 Project Objectives

The main objectives of TripMate are:

1. Simplify group trip planning and coordination.
2. Make shared expense management transparent.
3. Support flexible contributions and expense splitting.
4. Reduce confusion about personal payments and reimbursements.
5. Provide accurate final financial settlement.
6. Keep all trip-related information in one place.

## 🚀 Future Improvements

- Enhanced analytics and financial visualizations.
- More advanced trip planning tools.
- Improved notification system.
- Additional currency support.
- Cloud deployment and production optimization.
- Mobile application support.

## 👨‍💻 Developer

**Nahad Islam**

GitHub: [@nahad2](https://github.com/nahad2)

Project Repository: [TripMate](https://github.com/nahad2/TripMate)

---

<p align="center">
  <b>TripMate — Making Group Trips Easier, Smarter, and More Transparent.</b>
</p>
