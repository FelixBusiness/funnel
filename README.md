# Newsletter-Funnel (kostenlose Version)

Interaktiver Anmelde-Funnel mit Entscheidungsbaum, Datenbank in Google Sheets, wöchentlichen Abonnentenlisten, Double-Opt-in, Abmeldung, Dashboard und optionalem Versand – komplett kostenlos.

```
Instagram-Link
   │
   ▼
Funnel (index.html, GitHub Pages) ──► Google Apps Script (Web-App) ──► Google Sheet
                                         │                              ├─ Abonnenten        (alle Anmeldungen, Status)
                                         ├─ Bestätigungsmail (Gmail)    ├─ Funnel-Ereignisse  (Abbruchanalyse, anonym)
                                         ├─ Bestätigen / Abmelden       ├─ Wochenstatistik    (eine Zeile pro Woche)
                                         └─ Statistik ──► Dashboard     ├─ Newsletter-Entwurf (Betreff und Text)
                                                                        └─ Woche 41 2026, Woche 42 2026, …
```

| Datei | Zweck |
|---|---|
| `index.html` | Der Funnel – eine Frage pro Bildschirm, Verzweigungen, Profil, Anmeldung |
| `fragen.js` | **Der Entscheidungsbaum.** Hier änderst du Fragen, Antworten und Pfade |
| `config.js` | Web-App-Adresse, Name, Links |
| `dashboard.html` | Auswertung: Abonnenten, Verlauf, Abbrüche, Antworten, Aktienwünsche |
| `apps-script/Code.gs` | Datenbank-Logik für Google Sheets |
| `impressum.html`, `datenschutz.html` | Vorlagen – vor dem Livegang ausfüllen |

Ohne Web-App-Adresse in `config.js` laufen Funnel und Dashboard im **Demo-Modus** (nichts wird gespeichert, das Dashboard zeigt erfundene Zahlen). So kannst du alles sofort ansehen.

---

## Einrichtung (etwa 20 Minuten)

### Schritt 1 – Google Sheet und Skript

1. Neues Google Sheet anlegen, zum Beispiel „Newsletter Datenbank“. Am besten mit einem eigenen Google-Konto für den Newsletter, denn von diesem Konto werden die E-Mails verschickt.
2. Im Sheet: **Erweiterungen → Apps Script**.
3. Den Inhalt von `apps-script/Code.gs` komplett hineinkopieren und speichern.
4. Oben im Skript unter `CONFIG` Name, Links und Zeitzone anpassen.
5. Seite neu laden. Im Sheet erscheint das Menü **Newsletter**. Dort **1. Einrichtung ausführen** klicken.
   - Google fragt nach Berechtigungen (Tabelle, E-Mail senden, Auslöser). Bei „Diese App wurde nicht überprüft“ auf **Erweitert → Zu … wechseln (unsicher)** klicken – das ist dein eigenes Skript.
   - Am Ende erscheint dein **Dashboard-Schlüssel**. Notieren.

### Schritt 2 – Als Web-App bereitstellen

1. Im Apps-Script-Editor: **Bereitstellen → Neue Bereitstellung → Typ: Web-App**.
2. Ausführen als: **Ich**. Zugriff: **Jeder**.
3. **Bereitstellen** und die Adresse kopieren (endet auf `/exec`).
4. Die Adresse in `Code.gs` bei `WEB_APP_URL` eintragen, speichern und unter **Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Version: Neue Version** erneut bereitstellen. (Wichtig: Jede Änderung am Skript braucht eine neue Version, sonst läuft die alte weiter.)

### Schritt 3 – GitHub Pages

1. Neues Repository auf GitHub anlegen, zum Beispiel `newsletter-funnel`, und alle Dateien dieses Ordners hochladen (außer du willst `apps-script/` privat halten – es enthält keine Geheimnisse).
2. In `config.js` die Web-App-Adresse eintragen.
3. Im Repository: **Settings → Pages → Branch: main, Ordner: / (root) → Save**.
4. Nach etwa einer Minute ist der Funnel unter `https://DEIN-NAME.github.io/newsletter-funnel/` erreichbar, das Dashboard unter `…/dashboard.html`.
5. Die Funnel-Adresse in `Code.gs` bei `FUNNEL_URL` eintragen (für die Links in den Mails) und neu bereitstellen.

### Schritt 4 – Testen

1. Funnel auf dem Handy durchklicken und mit einer eigenen Adresse anmelden.
2. Bestätigungsmail öffnen, bestätigen → im Blatt „Abonnenten“ steht der Status jetzt auf `aktiv`.
3. Dashboard öffnen, Schlüssel eingeben.
4. Für ein volles Dashboard: Menü **Newsletter → Testdaten erzeugen**. Später **Testdaten löschen**.

### Instagram-Link

Für die Herkunftsauswertung den Link mit Quelle angeben:
`https://DEIN-NAME.github.io/newsletter-funnel/?utm_source=instagram`
(für eine Story zum Beispiel `?utm_source=instagram-story`).

---

## Der wöchentliche Ablauf

**Automatisch jeden Sonntag um 17 Uhr** legt das Skript ein neues Tabellenblatt „Woche XX JJJJ“ an – mit allen aktiven Abonnenten, ihren wichtigsten Antworten und dem persönlichen Abmeldelink. Gleichzeitig schreibt es die Kennzahlen der Woche ins Blatt „Wochenstatistik“. Das ist dein Archiv: Du siehst für jede Woche genau, wer auf der Liste stand.

Uhrzeit und Tag stellst du in `CONFIG` ein (danach erneut „Einrichtung ausführen“). Manuell geht es jederzeit über **Newsletter → Wochenliste jetzt erstellen**.

### Versand – zwei Wege

**A) Direkt aus dem Sheet (kostenlos):**
1. Im Blatt „Newsletter-Entwurf“ Betreff und Inhalt (HTML) eintragen. `{{vorname}}` wird ersetzt.
2. **Newsletter → Testmail an mich senden** zur Kontrolle.
3. **Newsletter → Newsletter an aktuelle Wochenliste senden.** Jede versendete Zeile bekommt einen Zeitstempel in `versendet_am`; doppelt wird nie gesendet.
4. Optional ein Filter, zum Beispiel `horizont=Langfristig` → nur an diese Gruppe.

Grenze: Ein normales Gmail-Konto darf etwa **100 Empfänger pro Tag** per Skript anschreiben (Google Workspace: 1.500). Darüber versendet das Skript den Rest beim nächsten Klick am Folgetag. Der Abmeldelink und der Risikohinweis werden automatisch unter jede Mail gesetzt.

**B) Wochenblatt exportieren:** Blatt „Woche XX“ als CSV herunterladen (Datei → Herunterladen) und in einen beliebigen Versanddienst importieren, sobald die Liste größer wird. Die ganze Datenbank lässt sich jederzeit über **Datei → Herunterladen → Microsoft Excel** als Excel-Datei sichern.

---

## Fragen ändern

Alles steht in `fragen.js`. Jede Antwort hat ein Ziel `weiter`, darüber entsteht der Entscheidungsbaum:

```js
{ text: 'Nein, noch nicht', symbol: '🌱', weiter: 'huerde' }
```

Neue Frage hinzufügen: Eintrag unter `fragen` anlegen und von einer Antwort aus mit `weiter` darauf verweisen. Damit sie in der Datenbank eine eigene Spalte bekommt, die Spalte in `Code.gs` bei `SPALTEN` und in `anmelden_` ergänzen sowie den Schritt in `FUNNEL_SCHRITTE` aufnehmen. Im Funnel den Fortschritt in `STUFE` (index.html) nachtragen.

---

## Bevor echte Fremde sich eintragen

- `impressum.html` und `datenschutz.html` ausfüllen und prüfen lassen.
- Google speichert die Daten möglicherweise außerhalb der Europäischen Union – für den Testbetrieb in Ordnung, für den Dauerbetrieb prüfen.
- Profilseite und Mails sagen nur, welche **Inhalte** passen – nie, welche Anlage passt. Bitte so lassen (keine individuelle Anlageberatung).
- Das Dashboard zeigt keine E-Mail-Adressen und ist nur mit Schlüssel abrufbar. Den Schlüssel nicht weitergeben. Neuen Schlüssel erzeugen: im Apps-Script-Editor unter **Projekteinstellungen → Skripteigenschaften** `DASHBOARD_SCHLUESSEL` löschen und „Einrichtung ausführen“.
- Wer „abgemeldet“ ist, bleibt als Zeile erhalten (Nachweis). Für eine Löschanfrage die Zeile von Hand löschen.
