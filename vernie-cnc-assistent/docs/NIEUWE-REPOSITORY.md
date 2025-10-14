# 📦 Nieuwe Repository Maken - Vernie CNC Assistent

Deze gids legt uit hoe je de Vernie CNC Assistent naar een eigen GitHub repository kunt verplaatsen.

## Optie 1: Handmatig een nieuwe repository maken

### Stap 1: Maak nieuwe repository op GitHub
1. Ga naar https://github.com/new
2. Repository naam: `vernie-cnc-assistent`
3. Beschrijving: `Een intelligente assistent voor CNC machineoperaties en productieondersteuning`
4. Kies: Public of Private
5. **Niet** aanvinken: "Initialize this repository with a README"
6. Klik op "Create repository"

### Stap 2: Kopieer de bestanden
```bash
# Maak een nieuwe directory
mkdir ~/vernie-cnc-assistent
cd ~/vernie-cnc-assistent

# Initialiseer Git
git init

# Kopieer alle bestanden van de Rework repository
cp -r /path/to/Rework/vernie-cnc-assistent/* .
cp -r /path/to/Rework/vernie-cnc-assistent/.* . 2>/dev/null || true

# Voeg alle bestanden toe
git add .
git commit -m "Initial commit: Vernie CNC Assistent"

# Koppel aan GitHub repository
git remote add origin https://github.com/jongkeescasper/vernie-cnc-assistent.git
git branch -M main
git push -u origin main
```

### Stap 3: Configureer de nieuwe repository
1. Voeg een beschrijving toe
2. Voeg topics toe: `cnc`, `manufacturing`, `nodejs`, `express`, `webhook`, `automation`
3. Configureer branch protection rules (optioneel)
4. Voeg collaborators toe (indien nodig)

---

## Optie 2: GitHub CLI gebruiken

### Voorbereiden
```bash
# Installeer GitHub CLI (indien nog niet geïnstalleerd)
# macOS
brew install gh

# Linux/WSL
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Windows
# Download van https://cli.github.com/

# Authenticeer
gh auth login
```

### Repository maken en pushen
```bash
# Kopieer bestanden naar nieuwe directory
mkdir ~/vernie-cnc-assistent
cd ~/vernie-cnc-assistent
cp -r /path/to/Rework/vernie-cnc-assistent/* .
cp -r /path/to/Rework/vernie-cnc-assistent/.* . 2>/dev/null || true

# Initialiseer Git
git init
git add .
git commit -m "Initial commit: Vernie CNC Assistent"

# Maak repository en push (alles in één commando!)
gh repo create vernie-cnc-assistent --public --source=. --remote=origin --push

# Of voor private repository:
# gh repo create vernie-cnc-assistent --private --source=. --remote=origin --push
```

---

## Optie 3: Git Subtree gebruiken (Geavanceerd)

Deze optie behoudt de git history van alleen de vernie-cnc-assistent directory.

```bash
# In de Rework repository
cd /path/to/Rework

# Maak nieuwe repository op GitHub (via web interface)
# Dan:
git subtree split --prefix=vernie-cnc-assistent -b vernie-cnc-assistent-branch

# Maak nieuwe directory en kopieer
mkdir ~/vernie-cnc-assistent
cd ~/vernie-cnc-assistent
git init
git pull /path/to/Rework vernie-cnc-assistent-branch

# Push naar nieuwe repository
git remote add origin https://github.com/jongkeescasper/vernie-cnc-assistent.git
git branch -M main
git push -u origin main
```

---

## Na het maken van de nieuwe repository

### 1. Update de documentatie
Update alle verwijzingen naar de repository locatie in:
- `README.md`
- `QUICKSTART.md`
- `docs/DEPLOYMENT.md`

Verander:
```bash
git clone https://github.com/jongkeescasper/Rework.git
cd Rework/vernie-cnc-assistent
```

Naar:
```bash
git clone https://github.com/jongkeescasper/vernie-cnc-assistent.git
cd vernie-cnc-assistent
```

### 2. Configureer GitHub Actions (optioneel)
Maak `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm install
    - run: npm test
```

### 3. Voeg badges toe aan README
```markdown
![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub Issues](https://img.shields.io/github/issues/jongkeescasper/vernie-cnc-assistent)
![GitHub Stars](https://img.shields.io/github/stars/jongkeescasper/vernie-cnc-assistent)
```

### 4. Deploy naar productie
Volg de [Deployment Handleiding](docs/DEPLOYMENT.md) om de applicatie te deployen naar:
- Render
- Heroku
- DigitalOcean
- Of een andere hosting provider

---

## Verifieer de nieuwe repository

```bash
# Clone de nieuwe repository
git clone https://github.com/jongkeescasper/vernie-cnc-assistent.git
cd vernie-cnc-assistent

# Test de applicatie
npm install
npm start

# Test endpoints
curl http://localhost:3001/
curl http://localhost:3001/api/machines
```

Als alles werkt, is de nieuwe repository succesvol aangemaakt! 🎉

---

## Troubleshooting

### "Repository already exists"
De repository naam is al in gebruik. Kies een andere naam of verwijder de bestaande repository eerst.

### "Permission denied"
Controleer of je de juiste permissies hebt. Je moet owner zijn of write access hebben.

### "Remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/jongkeescasper/vernie-cnc-assistent.git
```

### Bestanden missen
Controleer of je de hidden files (zoals `.env.example` en `.gitignore`) hebt gekopieerd:
```bash
ls -la
```

---

## Hulp nodig?

- GitHub Docs: https://docs.github.com/
- GitHub CLI Docs: https://cli.github.com/manual/
- Git Subtree Guide: https://www.atlassian.com/git/tutorials/git-subtree
