# FitTrack Pro - Application Requirements Documentation

## 1. Introduction
FitTrack Pro is a web-based application designed for Personal Trainers and Physiotherapists to manage client data, schedule sessions, create AI-powered training plans, and track business analytics. The system operates on a subscription model with localized data persistence simulation.

## 2. User Authentication & Account
*   **Login Mechanism:**
    *   The system must allow users (trainers) to log in using a Google Account (Simulated).
    *   Authentication state must persist across sessions.
*   **Data Storage:**
    *   Each trainer's data must be isolated.
    *   Data storage must simulate a cloud sync structure (e.g., Google Drive) where data is saved to the user's private storage.
*   **Subscription Model:**
    *   Users are categorized as "Free Tier" or "Pro Member".
    *   **Promo Codes:**
        *   Users can activate Pro membership by entering a valid promo code.
        *   Promo codes must be validated against a pre-defined list (simulating an external Excel/Database source).
        *   Valid codes include: 'PROMO2024', 'EARLYBIRD', 'TECHNINJA', 'DEMO'.

## 3. Dashboard
The dashboard serves as the landing page and must provide the following aggregated data:
*   **Statistics:**
    *   Total count of Active Clients.
    *   Total count of Sessions Completed (globally).
    *   Count of "Renewals Due" (Clients with $\le$ 1 session remaining).
*   **Visualizations:**
    *   A breakdown of training focus distribution (Strength, Cardio, Rehab, Mobility) displayed as a chart.
*   **Alerts:**
    *   A list of critical clients who have 1 or fewer sessions remaining.
    *   Quick action button to navigate to the specific client's profile for renewal.

## 4. Client Management
*   **Client List:**
    *   Display all clients with Name, Contact Info, and Session Balance progress bar.
    *   **Status Indicators:**
        *   *Active:* Sessions remaining > 0.
        *   *Completed:* Sessions remaining = 0.
        *   *Low Balance:* Visual warning (red) when sessions $\le$ 1.
*   **Add Client:**
    *   Ability to create a new client profile with: Name, Phone, and Initial Session Pack (count).
    *   Email input is currently disabled/optional.
*   **Search:**
    *   Real-time filtering of the client list by Name or Email.

## 5. Client Detail Profile
Each client profile must aggregate three core functional areas:

### 5.1. Session Management
*   **Balance Tracking:**
    *   Display `Sessions Remaining` vs `Total Sessions`.
    *   "Quick Mark Attendance" button to deduct 1 session immediately without detailed scheduling.
*   **Renewal:**
    *   Visual indicator when renewal is needed.

### 5.2. Plans & Workouts (Tab)
*   **Plan Creation:**
    *   **AI Generation:** Integration with Google Gemini (`gemini-2.5-flash`) to generate structured plans based on:
        *   Duration (Days/Weeks).
        *   Focus Areas (Strength, Endurance, Mobility, etc.).
        *   Client Context/Notes.
    *   **Manual Creation:** Ability to build plans from scratch.
*   **Plan Structure:**
    *   A Plan consists of multiple `Sessions`.
    *   A Session consists of `Day Label`, `Focus`, and a list of `Exercises`.
    *   An Exercise includes `Name`, `Type` (Warmup/Main/Cool Down), `Sets`, `Reps`, and `Remarks`.
*   **Sharing:**
    *   Ability to generate a formatted WhatsApp message link containing the full training plan text.
*   **Editing:**
    *   Full CRUD capability for Plans, Sessions, and Exercises.
    *   Ability to reorder sessions and exercises.

### 5.3. Notes & Progress (Tab)
*   **Progress Log:**
    *   Input field for adding text-based progress notes.
    *   Chronological list of all past notes with timestamps.
    *   Ability to delete specific note entries.
*   **General Notes:**
    *   A persistent text area for Medical History or General Context (fed into AI for plan generation).

### 5.4. History & Attendance (Tab)
*   **Log View:**
    *   Table displaying all past sessions (Scheduled dates that have passed, or manually completed sessions).
    *   Columns: Date, Status, Notes.
*   **Routine Details:**
    *   If a session history log contains structured workout data, a "View Routine Details" button must appear.
    *   Clicking opens a modal showing the specific exercises performed during that session.

## 6. Scheduling System
*   **View Logic:**
    *   The Schedule page must **only** display upcoming sessions (`datetime > now`).
    *   Historical/Past sessions must be automatically moved to the Client's History tab.
*   **Adding Sessions:**
    *   Select Client, Date, Time, and Label.
    *   **Plan Linking:**
        *   Option to link a schedule slot to a specific session from an existing Training Plan.
        *   **Deep Copy:** Linking a plan must create a *copy* of the exercises for that specific schedule instance. Editing the scheduled workout must not affect the original plan template.
        *   **Filtering:** Ability to filter plan sessions by "Pending" or "Completed" status during selection.
*   **Session Actions:**
    *   **Complete:** 
        *   Moves session to Client History.
        *   Deducts 1 from Client Session Balance.
        *   Marks the linked Plan Session as `completed` (if applicable).
    *   **Cancel:**
        *   Updates status to `cancelled`.
        *   Removes from Schedule view (effectively moved to history logic if time passed, or stays as cancelled if future).
    *   **Edit Workout:**
        *   Ability to modify the specific exercises, sets, and reps for a scheduled session.
*   **Constraint:**
    *   **No Delete:** Users cannot permanently delete a schedule entry; they must either Cancel it or Mark as Done.

## 7. Future Features (Labs)
*   A placeholder section to display roadmap items (e.g., Wearable Integration, Video Analysis).

## 8. Support
*   A dedicated Help section providing the support email (`techninja1.baxel@protonmail.com`) for bug reports and feature requests.

## 9. Technical Requirements
*   **Framework:** React 19.
*   **Styling:** Tailwind CSS.
*   **Icons:** Lucide React.
*   **AI Provider:** @google/genai SDK.
*   **Persistence:** LocalStorage (simulating Cloud Sync).
