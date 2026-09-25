# Nadir Birthday Quiz

Slido-style multiplayer birthday quiz for **Mehdiyev Nadir Polad oğlu**.

### Included
- 10 supplied questions and correct answers
- Player name entry
- One locked answer per question
- 15-second timer
- Correct answer revealed after 15 seconds
- Automatic next question after a 3-second reveal
- Final leaderboard
- Winner by highest correct-answer count
- Tie-break by lowest total response time
- Host panel with QR code and Start/Reset controls

### Run locally
1. Install Node.js 18+.
2. In Terminal:
   ```bash
   npm install
   npm start
   ```
3. Host opens `http://localhost:3000/host.html`.
4. Phones on the same Wi-Fi can open the computer's local IP, e.g. `http://192.168.1.20:3000/`.
5. The host panel displays the QR code for the join address.

### Public link
To let guests join from anywhere, deploy this Node app to a Node-compatible hosting service and set:
```bash
PUBLIC_URL=https://your-public-domain.example
```
The host QR then points to that public URL.

### Portrait
The supplied Soviet-era portrait is embedded on the landing page at `public/assets/nadir-soviet.png`.
