# KlassenBattle KI + Multiplayer

## Was neu ist
Die Server-Version kann Schülerantworten über die OpenAI Responses API bewerten.
Der API-Key wird NICHT im Browser gespeichert.

## Online auf Render
1. Projekt zu GitHub hochladen.
2. Auf Render einen Web Service erstellen.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. In Render unter Environment eine Variable anlegen:
   `OPENAI_API_KEY` = dein OpenAI API-Key
6. Deploy.

Die OpenAI-Dokumentation empfiehlt für neue Integrationen die Responses API. Der API-Key gehört in eine serverseitige Umgebungsvariable und nicht in `public/index.html`.

## Kosten
Die OpenAI API wird separat nach Nutzung abgerechnet. Vor einem echten Schulbetrieb sollte ein Lehrer/Erziehungsberechtigter bzw. die verantwortliche Person das Konto und die Abrechnung einrichten.

## Ohne API-Key
Das Spiel läuft weiterhin, verwendet dann aber nur die einfache Demo-Bewertung.
