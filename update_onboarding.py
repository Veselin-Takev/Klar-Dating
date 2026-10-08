import re

file_path = "src/screens/Onboarding.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Prüfen, ob Musik bereits drin ist, wenn nicht, hinzufügen
if "Musik" not in content:
    # Suche nach dem Array der Interessen und füge Musik hinzu
    # Wir suchen nach typischen Mustern für Interessen-Arrays im Onboarding
    print("Füge Musik zum Onboarding hinzu...")
    # Fallback: Wir hängen es an bekannte Arrays an oder geben einen Hinweis
