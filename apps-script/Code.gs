/**
 * Newsletter-Funnel – Datenbank und Logik (Google Apps Script)
 * -------------------------------------------------------------
 * Dieses Skript gehört in ein Google Sheet (Erweiterungen → Apps Script).
 * Es übernimmt:
 *   - Anmeldungen aus dem Funnel entgegennehmen (doPost)
 *   - Double-Opt-in: Bestätigungsmail und Bestätigungslink (doGet)
 *   - Abmeldung über persönlichen Link (doGet)
 *   - Statistik für das Dashboard (doGet, geschützt mit Schlüssel)
 *   - Jeden Sonntag ein neues Tabellenblatt „Woche XX JJJJ“ mit allen aktiven Abonnenten
 *   - Optional: Newsletter an die Wochenliste versenden (über Gmail)
 *
 * Einrichtung: siehe README.md im Repository.
 */

// ===================== EINSTELLUNGEN – BITTE ANPASSEN =====================
const CONFIG = {
  NEWSLETTER_NAME: 'Nebenwerte Wochenbrief',
  ABSENDER_NAME: 'Nebenwerte Wochenbrief',
  // Nach der ersten Bereitstellung als Web-App hier die Adresse eintragen (endet auf /exec)
  WEB_APP_URL: '',
  FUNNEL_URL: 'https://DEIN-GITHUB-NAME.github.io/newsletter-funnel/',
  INSTAGRAM_URL: 'https://www.instagram.com/DEIN_PROFIL/',
  WIKIFOLIO_URL: 'https://www.wikifolio.com/',
  IMPRESSUM_URL: 'https://DEIN-GITHUB-NAME.github.io/newsletter-funnel/impressum.html',
  ZEITZONE: 'Europe/Berlin',
  // Wochenabschluss: Sonntag um 17 Uhr wird das neue Wochenblatt angelegt
  WOCHENABSCHLUSS_TAG: ScriptApp.WeekDay.SUNDAY,
  WOCHENABSCHLUSS_STUNDE: 17,
  RISIKOHINWEIS: 'Keine Anlageberatung. Die Inhalte dienen ausschließlich der Information und stellen keine Aufforderung zum Kauf oder Verkauf von Wertpapieren dar. Vergangene Wertentwicklungen sind kein verlässlicher Indikator für künftige Ergebnisse. Aktien können erheblich an Wert verlieren.'
};
// ==========================================================================

const BLATT_ABOS = 'Abonnenten';
const BLATT_EREIGNISSE = 'Funnel-Ereignisse';
const BLATT_STATISTIK = 'Wochenstatistik';
const BLATT_ENTWURF = 'Newsletter-Entwurf';

const SPALTEN = [
  'id', 'token', 'email', 'vorname', 'status',
  'angemeldet_am', 'bestaetigt_am', 'abgemeldet_am',
  'investiert', 'nebenwerte', 'huerde', 'horizont', 'themen', 'aktienwunsch', 'premium',
  'profil', 'quelle', 'einwilligung'
];
const SPALTEN_EREIGNISSE = ['zeitpunkt', 'sitzung', 'ereignis', 'schritt', 'quelle'];
const SPALTEN_STATISTIK = ['woche', 'stichtag', 'aktiv', 'ausstehend', 'abgemeldet_gesamt', 'neu_bestaetigt_7_tage', 'neu_abgemeldet_7_tage', 'premium_interesse'];
const SPALTEN_WOCHE = ['email', 'vorname', 'investiert', 'horizont', 'themen', 'premium', 'abmeldelink', 'versendet_am'];

// Reihenfolge der Funnel-Schritte für die Abbruchanalyse
const FUNNEL_SCHRITTE = ['start', 'investiert', 'nebenwerte', 'huerde', 'horizont', 'themen', 'wunsch', 'premium', 'ergebnis', 'abgeschickt'];

// ============================== MENÜ ======================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Newsletter')
    .addItem('1. Einrichtung ausführen', 'setup')
    .addSeparator()
    .addItem('Wochenliste jetzt erstellen', 'wochenabschluss')
    .addItem('Testmail an mich senden', 'testmailSenden')
    .addItem('Newsletter an aktuelle Wochenliste senden', 'newsletterVersenden')
    .addSeparator()
    .addItem('Testdaten erzeugen (für das Dashboard)', 'testdatenErzeugen')
    .addItem('Testdaten löschen', 'testdatenLoeschen')
    .addToUi();
}

/** Legt alle Tabellenblätter an, erzeugt den Dashboard-Schlüssel und den wöchentlichen Auslöser. */
function setup() {
  blatt_(BLATT_ABOS, SPALTEN);
  blatt_(BLATT_EREIGNISSE, SPALTEN_EREIGNISSE);
  blatt_(BLATT_STATISTIK, SPALTEN_STATISTIK);
  const entwurf = blatt_(BLATT_ENTWURF, ['feld', 'wert']);
  if (entwurf.getLastRow() < 2) {
    entwurf.getRange(2, 1, 3, 2).setValues([
      ['betreff', 'Dein Wochenrückblick'],
      ['inhalt_html', '<p>Hallo {{vorname}},</p><p>hier ist dein Wochenrückblick zu deutschen Nebenwerten.</p><h3>1. Marktüberblick</h3><p>…</p><h3>2. Update Musterportfolio</h3><p>…</p><h3>3. Idee der Woche</h3><p>…</p>'],
      ['filter', '']
    ]);
    entwurf.getRange('C1').setValue('Hinweis: {{vorname}} wird ersetzt. Filter optional, zum Beispiel: horizont=Langfristig für die Rente');
    entwurf.setColumnWidth(2, 600);
  }

  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('DASHBOARD_SCHLUESSEL')) {
    props.setProperty('DASHBOARD_SCHLUESSEL', Utilities.getUuid().replace(/-/g, '').slice(0, 24));
  }

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'wochenabschluss')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('wochenabschluss')
    .timeBased()
    .onWeekDay(CONFIG.WOCHENABSCHLUSS_TAG)
    .atHour(CONFIG.WOCHENABSCHLUSS_STUNDE)
    .inTimezone(CONFIG.ZEITZONE)
    .create();

  const schluessel = props.getProperty('DASHBOARD_SCHLUESSEL');
  Logger.log('Einrichtung abgeschlossen. Dein Dashboard-Schlüssel: ' + schluessel);
  try {
    SpreadsheetApp.getUi().alert('Einrichtung abgeschlossen.\n\nDein Dashboard-Schlüssel:\n' + schluessel + '\n\nBitte notieren – du brauchst ihn für das Dashboard.');
  } catch (e) { /* ohne Oberfläche ausgeführt */ }
}

// ============================ WEB-APP =====================================

function doPost(e) {
  let daten;
  try {
    daten = JSON.parse(e.postData.contents);
  } catch (fehler) {
    return json_({ ok: false, fehler: 'Ungültige Daten.' });
  }
  if (daten.typ === 'ereignis') {
    ereignisSpeichern_(daten);
    return json_({ ok: true });
  }
  if (daten.typ === 'anmeldung') {
    return json_(anmelden_(daten));
  }
  return json_({ ok: false, fehler: 'Unbekannter Typ.' });
}

function doGet(e) {
  const p = (e && e.parameter) || {};

  if (p.aktion === 'bestaetigen') {
    const ergebnis = statusSetzen_(p.token, 'aktiv');
    if (!ergebnis) return seite_('Link ungültig', '<p>Dieser Bestätigungslink ist ungültig oder abgelaufen. Melde dich einfach erneut an.</p>' + knopf_(CONFIG.FUNNEL_URL, 'Zur Anmeldung'));
    const hallo = ergebnis.vorname ? 'Danke, ' + esc_(ergebnis.vorname) + '!' : 'Danke!';
    return seite_('Anmeldung bestätigt',
      '<p class="gross">' + hallo + '</p><p>Deine Anmeldung ist bestätigt. Die nächste Ausgabe kommt am Sonntagabend in dein Postfach.</p>' +
      '<p>Bis dahin:</p>' + knopf_(CONFIG.WIKIFOLIO_URL, 'Musterportfolio auf Wikifolio ansehen') + knopf_(CONFIG.INSTAGRAM_URL, 'Auf Instagram folgen', true));
  }

  if (p.aktion === 'abmelden') {
    const ergebnis = statusSetzen_(p.token, 'abgemeldet');
    if (!ergebnis) return seite_('Link ungültig', '<p>Dieser Abmeldelink ist ungültig. Falls du weiterhin E-Mails bekommst, antworte einfach auf eine Ausgabe.</p>');
    return seite_('Abgemeldet',
      '<p class="gross">Du bist abgemeldet.</p><p>Du bekommst keine weiteren E-Mails mehr von uns. Schade, dass du gehst!</p>' +
      '<p>Versehentlich abgemeldet?</p>' + knopf_(CONFIG.FUNNEL_URL, 'Wieder anmelden', true));
  }

  if (p.aktion === 'statistik') {
    const schluessel = PropertiesService.getScriptProperties().getProperty('DASHBOARD_SCHLUESSEL');
    if (!schluessel || p.schluessel !== schluessel) return json_({ ok: false, fehler: 'Falscher Schlüssel.' });
    return json_(statistik_());
  }

  return seite_(CONFIG.NEWSLETTER_NAME, '<p>Hier gibt es nichts zu sehen.</p>' + knopf_(CONFIG.FUNNEL_URL, 'Zum Newsletter'));
}

// ============================ ANMELDUNG ===================================

function anmelden_(d) {
  if (d.website) return { ok: true }; // Honigtopf-Feld: Bots füllen es aus, Menschen sehen es nicht

  const email = String(d.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
    return { ok: false, fehler: 'Bitte gib eine gültige E-Mail-Adresse ein.' };
  }
  if (!d.einwilligung) return { ok: false, fehler: 'Bitte bestätige die Einwilligung.' };

  const a = d.antworten || {};
  const jetzt = new Date();
  const werte = {
    email: email,
    vorname: sauber_(d.vorname, 60),
    investiert: sauber_(a.investiert),
    nebenwerte: sauber_(a.nebenwerte),
    huerde: sauber_(a.huerde),
    horizont: sauber_(a.horizont),
    themen: (Array.isArray(a.themen) ? a.themen : []).map(t => sauber_(t)).join(', '),
    aktienwunsch: sauber_(a.wunsch, 300),
    premium: sauber_(a.premium),
    profil: sauber_(d.profil, 120),
    quelle: sauber_(d.quelle, 100),
    einwilligung: sauber_(d.einwilligungstext, 400) + ' | Zeitpunkt: ' + zeit_(jetzt)
  };

  const sperre = LockService.getScriptLock();
  sperre.waitLock(20000);
  let mailAn = null;
  try {
    const blatt = blatt_(BLATT_ABOS, SPALTEN);
    const daten = blatt.getDataRange().getValues();
    const kopf = daten[0];
    const idx = index_(kopf);

    let zeile = -1;
    for (let i = 1; i < daten.length; i++) {
      if (String(daten[i][idx.email]).toLowerCase() === email) { zeile = i; break; }
    }

    if (zeile === -1) {
      werte.id = Utilities.getUuid();
      werte.token = Utilities.getUuid();
      werte.status = 'ausstehend';
      werte.angemeldet_am = jetzt;
      blatt.appendRow(kopf.map(k => (werte[k] !== undefined ? werte[k] : '')));
      mailAn = werte;
    } else {
      const reihe = daten[zeile];
      const alterStatus = reihe[idx.status];
      Object.keys(werte).forEach(k => { if (idx[k] !== undefined) reihe[idx[k]] = werte[k]; });
      if (alterStatus !== 'aktiv') {
        // Neu anmelden (zum Beispiel nach Abmeldung oder nie bestätigt)
        reihe[idx.token] = Utilities.getUuid();
        reihe[idx.status] = 'ausstehend';
        reihe[idx.angemeldet_am] = jetzt;
        reihe[idx.bestaetigt_am] = '';
        reihe[idx.abgemeldet_am] = '';
        mailAn = { email: email, vorname: werte.vorname, token: reihe[idx.token] };
      }
      blatt.getRange(zeile + 1, 1, 1, kopf.length).setValues([reihe]);
    }
  } finally {
    sperre.releaseLock();
  }

  if (mailAn) bestaetigungsmail_(mailAn.email, mailAn.vorname, mailAn.token);
  // Bewusst immer dieselbe Antwort, damit niemand prüfen kann, ob eine Adresse schon eingetragen ist
  return { ok: true };
}

function bestaetigungsmail_(email, vorname, token) {
  const link = webAppUrl_() + '?aktion=bestaetigen&token=' + encodeURIComponent(token);
  const hallo = vorname ? 'Hallo ' + esc_(vorname) + ',' : 'Hallo,';
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1b2333;line-height:1.55">' +
    '<h2 style="margin:0 0 16px">Bitte bestätige deine Anmeldung</h2>' +
    '<p>' + hallo + '</p>' +
    '<p>danke für dein Interesse am ' + esc_(CONFIG.NEWSLETTER_NAME) + '. Bitte bestätige mit einem Klick, dass du den kostenlosen Newsletter einmal pro Woche erhalten möchtest:</p>' +
    '<p style="margin:28px 0"><a href="' + link + '" style="background:#14365c;color:#fff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Anmeldung bestätigen</a></p>' +
    '<p style="font-size:13px;color:#5b6577">Falls du dich nicht angemeldet hast, ignoriere diese E-Mail einfach. Ohne Bestätigung erhältst du keine weiteren Nachrichten.</p>' +
    '</div>';
  MailApp.sendEmail({ to: email, subject: 'Bitte bestätige deine Anmeldung', htmlBody: html, name: CONFIG.ABSENDER_NAME });
}

function statusSetzen_(token, neuerStatus) {
  if (!token) return null;
  const sperre = LockService.getScriptLock();
  sperre.waitLock(20000);
  try {
    const blatt = blatt_(BLATT_ABOS, SPALTEN);
    const daten = blatt.getDataRange().getValues();
    const idx = index_(daten[0]);
    for (let i = 1; i < daten.length; i++) {
      if (daten[i][idx.token] !== token) continue;
      const jetzt = new Date();
      if (neuerStatus === 'aktiv') {
        if (daten[i][idx.status] === 'abgemeldet') return null; // alter Bestätigungslink nach Abmeldung
        if (daten[i][idx.status] !== 'aktiv') {
          blatt.getRange(i + 1, idx.status + 1).setValue('aktiv');
          blatt.getRange(i + 1, idx.bestaetigt_am + 1).setValue(jetzt);
        }
      } else if (neuerStatus === 'abgemeldet') {
        if (daten[i][idx.status] !== 'abgemeldet') {
          blatt.getRange(i + 1, idx.status + 1).setValue('abgemeldet');
          blatt.getRange(i + 1, idx.abgemeldet_am + 1).setValue(jetzt);
        }
      }
      return { vorname: daten[i][idx.vorname] };
    }
    return null;
  } finally {
    sperre.releaseLock();
  }
}

function ereignisSpeichern_(d) {
  const schritt = sauber_(d.schritt, 40);
  if (FUNNEL_SCHRITTE.indexOf(schritt) === -1) return;
  blatt_(BLATT_EREIGNISSE, SPALTEN_EREIGNISSE)
    .appendRow([new Date(), sauber_(d.sitzung, 40), 'schritt', schritt, sauber_(d.quelle, 100)]);
}

// ========================== WOCHENABSCHLUSS ===============================

/** Läuft jeden Sonntag automatisch: neues Blatt „Woche XX JJJJ“ mit allen aktiven Abonnenten. */
function wochenabschluss() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const jetzt = new Date();
  const name = wochenName_(jetzt);
  const alle = zeilen_();
  const aktive = alle.filter(r => r.status === 'aktiv');

  let blatt = ss.getSheetByName(name);
  const schonVersendet = {};
  if (blatt) {
    // Wenn die Woche erneut erstellt wird: bereits versendete Mails nicht vergessen
    const alt = blatt.getDataRange().getValues();
    const i = index_(alt[0]);
    for (let r = 1; r < alt.length; r++) if (alt[r][i.versendet_am]) schonVersendet[alt[r][i.email]] = alt[r][i.versendet_am];
    blatt.clear();
  } else {
    blatt = ss.insertSheet(name, 4);
  }

  blatt.getRange(1, 1, 1, SPALTEN_WOCHE.length).setValues([SPALTEN_WOCHE]).setFontWeight('bold');
  const werte = aktive.map(r => [r.email, r.vorname, r.investiert, r.horizont, r.themen, r.premium, abmeldelink_(r.token), schonVersendet[r.email] || '']);
  if (werte.length) blatt.getRange(2, 1, werte.length, SPALTEN_WOCHE.length).setValues(werte);
  blatt.setFrozenRows(1);
  blatt.autoResizeColumns(1, 6);

  // Kennzahlen der Woche festhalten (eine Zeile pro Woche)
  const vor7 = new Date(jetzt.getTime() - 7 * 864e5);
  const zeile = [
    name, jetzt,
    aktive.length,
    alle.filter(r => r.status === 'ausstehend').length,
    alle.filter(r => r.status === 'abgemeldet').length,
    alle.filter(r => r.bestaetigt_am instanceof Date && r.bestaetigt_am >= vor7).length,
    alle.filter(r => r.abgemeldet_am instanceof Date && r.abgemeldet_am >= vor7).length,
    aktive.filter(r => String(r.premium).indexOf('Ja') === 0).length
  ];
  const statistik = blatt_(BLATT_STATISTIK, SPALTEN_STATISTIK);
  const vorhandene = statistik.getDataRange().getValues();
  let ersetzt = false;
  for (let r = 1; r < vorhandene.length; r++) {
    if (vorhandene[r][0] === name) {
      statistik.getRange(r + 1, 1, 1, zeile.length).setValues([zeile]);
      ersetzt = true;
      break;
    }
  }
  if (!ersetzt) statistik.appendRow(zeile);
  Logger.log(name + ': ' + aktive.length + ' aktive Abonnenten.');
}

// ============================ VERSAND =====================================

/** Sendet den Entwurf aus dem Blatt „Newsletter-Entwurf“ an alle aktiven Abonnenten der aktuellen Woche. */
function newsletterVersenden() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = wochenName_(new Date());
  if (!ss.getSheetByName(name)) wochenabschluss();
  const blatt = ss.getSheetByName(name);
  const entwurf = entwurf_();
  if (!entwurf.betreff || !entwurf.inhalt_html) throw new Error('Bitte Betreff und Inhalt im Blatt „Newsletter-Entwurf“ ausfüllen.');

  const daten = blatt.getDataRange().getValues();
  const idx = index_(daten[0]);
  const filter = filter_(entwurf.filter);
  const empfaenger = [];
  for (let r = 1; r < daten.length; r++) {
    if (daten[r][idx.versendet_am]) continue; // nie doppelt senden
    if (filter && String(daten[r][idx[filter.spalte]] || '').indexOf(filter.wert) === -1) continue;
    empfaenger.push(r);
  }
  if (!empfaenger.length) { meldung_('Keine offenen Empfänger in ' + name + '.'); return; }

  const kontingent = MailApp.getRemainingDailyQuota();
  if (empfaenger.length > kontingent) {
    meldung_('Achtung: Heute können nur noch ' + kontingent + ' E-Mails gesendet werden, benötigt werden ' + empfaenger.length + '. Es werden die ersten ' + kontingent + ' versendet – den Rest morgen erneut über das Menü senden.');
  }

  let gesendet = 0;
  empfaenger.slice(0, kontingent).forEach(r => {
    const reihe = daten[r];
    MailApp.sendEmail({
      to: reihe[idx.email],
      subject: entwurf.betreff,
      htmlBody: newsletterHtml_(entwurf.inhalt_html, reihe[idx.vorname], reihe[idx.abmeldelink]),
      name: CONFIG.ABSENDER_NAME
    });
    blatt.getRange(r + 1, idx.versendet_am + 1).setValue(new Date());
    gesendet++;
  });
  meldung_(gesendet + ' E-Mails versendet (' + name + ').');
}

function testmailSenden() {
  const entwurf = entwurf_();
  const an = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to: an,
    subject: '[Test] ' + (entwurf.betreff || 'Newsletter'),
    htmlBody: newsletterHtml_(entwurf.inhalt_html || '<p>Kein Inhalt</p>', 'Test', '#'),
    name: CONFIG.ABSENDER_NAME
  });
  meldung_('Testmail an ' + an + ' gesendet.');
}

function newsletterHtml_(inhalt, vorname, abmeldelink) {
  const text = String(inhalt).replace(/\{\{vorname\}\}/g, esc_(vorname || 'liebe Leserin, lieber Leser'));
  return '<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;color:#1b2333;line-height:1.6;font-size:16px">' +
    text +
    '<hr style="border:none;border-top:1px solid #dde2ea;margin:32px 0 16px">' +
    '<p style="font-family:Arial,sans-serif;font-size:12px;color:#5b6577">' + esc_(CONFIG.RISIKOHINWEIS) + '</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:12px;color:#5b6577">Du erhältst diese E-Mail, weil du den ' + esc_(CONFIG.NEWSLETTER_NAME) + ' abonniert hast. ' +
    '<a href="' + abmeldelink + '" style="color:#5b6577">Hier abmelden</a> · <a href="' + CONFIG.IMPRESSUM_URL + '" style="color:#5b6577">Impressum</a></p>' +
    '</div>';
}

// ============================ STATISTIK ===================================

function statistik_() {
  const alle = zeilen_().filter(r => r.email);
  const aktive = alle.filter(r => r.status === 'aktiv');
  const jetzt = new Date();

  // Verlauf der letzten 12 Wochen
  const verlauf = [];
  const dieseWoche = wochenStart_(jetzt);
  for (let i = 11; i >= 0; i--) {
    const von = new Date(dieseWoche.getTime() - i * 7 * 864e5);
    const bis = new Date(von.getTime() + 7 * 864e5);
    verlauf.push({
      woche: 'Woche ' + isoWoche_(von).woche,
      aktiv: alle.filter(r => r.bestaetigt_am instanceof Date && r.bestaetigt_am < bis &&
        !(r.abgemeldet_am instanceof Date && r.abgemeldet_am < bis)).length,
      neu: alle.filter(r => r.bestaetigt_am instanceof Date && r.bestaetigt_am >= von && r.bestaetigt_am < bis).length,
      abgemeldet: alle.filter(r => r.abgemeldet_am instanceof Date && r.abgemeldet_am >= von && r.abgemeldet_am < bis).length
    });
  }

  // Abbruchanalyse: eindeutige Sitzungen pro Schritt in den letzten 30 Tagen
  const grenze = new Date(jetzt.getTime() - 30 * 864e5);
  const ereignisse = blatt_(BLATT_EREIGNISSE, SPALTEN_EREIGNISSE).getDataRange().getValues().slice(1);
  const sitzungenProSchritt = {};
  const quellen = {};
  ereignisse.forEach(e => {
    if (!(e[0] instanceof Date) || e[0] < grenze) return;
    const schritt = e[3];
    (sitzungenProSchritt[schritt] = sitzungenProSchritt[schritt] || {})[e[1]] = true;
    if (schritt === 'start') quellen[e[4] || 'direkt'] = (quellen[e[4] || 'direkt'] || 0) + 1;
  });
  const funnel = FUNNEL_SCHRITTE.map(s => ({ schritt: s, sitzungen: Object.keys(sitzungenProSchritt[s] || {}).length }));

  const vor7 = new Date(jetzt.getTime() - 7 * 864e5);
  return {
    ok: true,
    stand: zeit_(jetzt),
    summen: {
      aktiv: aktive.length,
      ausstehend: alle.filter(r => r.status === 'ausstehend').length,
      abgemeldet: alle.filter(r => r.status === 'abgemeldet').length,
      neu7: alle.filter(r => r.bestaetigt_am instanceof Date && r.bestaetigt_am >= vor7).length,
      abgemeldet7: alle.filter(r => r.abgemeldet_am instanceof Date && r.abgemeldet_am >= vor7).length,
      premium: aktive.filter(r => String(r.premium).indexOf('Ja') === 0).length
    },
    verlauf: verlauf,
    funnel: funnel,
    quellen: quellen,
    verteilungen: {
      investiert: zaehlen_(aktive, 'investiert'),
      nebenwerte: zaehlen_(aktive, 'nebenwerte'),
      huerde: zaehlen_(aktive, 'huerde'),
      horizont: zaehlen_(aktive, 'horizont'),
      themen: zaehlen_(aktive, 'themen', true),
      premium: zaehlen_(aktive, 'premium')
    },
    // Nur Text und Datum, keine E-Mail-Adressen
    wuensche: alle
      .filter(r => r.aktienwunsch)
      .sort((a, b) => (b.angemeldet_am || 0) - (a.angemeldet_am || 0))
      .slice(0, 50)
      .map(r => ({ datum: r.angemeldet_am instanceof Date ? zeit_(r.angemeldet_am).slice(0, 10) : '', text: String(r.aktienwunsch) }))
  };
}

// ============================ TESTDATEN ===================================

function testdatenErzeugen() {
  const blatt = blatt_(BLATT_ABOS, SPALTEN);
  const ereignisse = blatt_(BLATT_EREIGNISSE, SPALTEN_EREIGNISSE);
  const kopf = blatt.getRange(1, 1, 1, blatt.getLastColumn()).getValues()[0];
  const zufall = arr => arr[Math.floor(Math.random() * arr.length)];
  const investiert = ['Ja, auch in Einzelaktien', 'Ja, aber nur über Indexfonds oder Fonds', 'Nein, noch nicht'];
  const nebenwerte = ['Ja, regelmäßig', 'Ein paar', 'Nein, noch nicht', 'Was sind Nebenwerte?'];
  const huerde = ['Mir fehlt das Wissen', 'Mir fehlt die Zeit', 'Ich weiß nicht, wem ich vertrauen kann', 'Ich warte auf den richtigen Zeitpunkt'];
  const horizont = ['Kurzfristig und opportunistisch', 'Mittelfristig (1 bis 5 Jahre)', 'Langfristig für die Rente', 'Gemischt'];
  const themen = ['Deutsche Nebenwerte', 'Dividenden', 'Wachstum und Technologie', 'Sondersituationen', 'Bewertung verstehen lernen', 'Makro und Zinsen'];
  const premium = ['Ja, setz mich auf die Warteliste', 'Vielleicht später', 'Nein, der Gratis-Newsletter reicht mir'];
  const wuensche = ['Hensoldt', 'Mutares', 'Dividendenstrategie erklärt', 'Pfisterer', 'Wie bewertet man Versorger?', 'Atoss Software', '', '', ''];
  const jetzt = Date.now();
  const zeilen = [];
  for (let i = 0; i < 60; i++) {
    const angemeldet = new Date(jetzt - Math.random() * 80 * 864e5);
    const inv = zufall(investiert);
    const status = Math.random() < 0.12 ? 'abgemeldet' : (Math.random() < 0.1 ? 'ausstehend' : 'aktiv');
    const bestaetigt = status === 'ausstehend' ? '' : new Date(angemeldet.getTime() + Math.random() * 6 * 36e5);
    const abgemeldet = status === 'abgemeldet' ? new Date(bestaetigt.getTime() + Math.random() * (jetzt - bestaetigt.getTime())) : '';
    const w = {
      id: Utilities.getUuid(), token: Utilities.getUuid(), email: 'test' + i + '@example.com', vorname: 'Test' + i, status: status,
      angemeldet_am: angemeldet, bestaetigt_am: bestaetigt, abgemeldet_am: abgemeldet,
      investiert: inv,
      nebenwerte: inv.indexOf('Einzelaktien') > -1 ? zufall(nebenwerte) : '',
      huerde: inv.indexOf('Nein') === 0 ? zufall(huerde) : '',
      horizont: zufall(horizont),
      themen: themen.filter(() => Math.random() < 0.4).join(', ') || themen[0],
      aktienwunsch: zufall(wuensche), premium: zufall(premium), profil: '', quelle: 'testdaten', einwilligung: 'Testdaten'
    };
    zeilen.push(kopf.map(k => (w[k] !== undefined ? w[k] : '')));
  }
  blatt.getRange(blatt.getLastRow() + 1, 1, zeilen.length, kopf.length).setValues(zeilen);

  const ev = [];
  for (let s = 0; s < 150; s++) {
    const sitzung = 'test-' + s;
    const zeit = new Date(jetzt - Math.random() * 25 * 864e5);
    const inv = Math.random();
    const pfad = ['start', 'investiert', inv < 0.45 ? 'nebenwerte' : (inv < 0.7 ? 'huerde' : null), 'horizont', 'themen', 'wunsch', 'premium', 'ergebnis', 'abgeschickt'].filter(Boolean);
    const abbruch = Math.random() < 0.55 ? Math.floor(1 + Math.random() * pfad.length) : pfad.length;
    pfad.slice(0, abbruch).forEach(schritt => ev.push([zeit, sitzung, 'schritt', schritt, 'testdaten']));
  }
  ereignisse.getRange(ereignisse.getLastRow() + 1, 1, ev.length, SPALTEN_EREIGNISSE.length).setValues(ev);
  meldung_('60 Test-Abonnenten und 150 Test-Sitzungen angelegt (Quelle „testdaten“).');
}

function testdatenLoeschen() {
  [[BLATT_ABOS, 'quelle'], [BLATT_EREIGNISSE, 'quelle']].forEach(([name, spalte]) => {
    const blatt = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (!blatt) return;
    const daten = blatt.getDataRange().getValues();
    const i = daten[0].indexOf(spalte);
    for (let r = daten.length - 1; r >= 1; r--) if (daten[r][i] === 'testdaten') blatt.deleteRow(r + 1);
  });
  meldung_('Testdaten gelöscht.');
}

// ============================ HILFSFUNKTIONEN =============================

function blatt_(name, spalten) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let blatt = ss.getSheetByName(name);
  if (!blatt) blatt = ss.insertSheet(name);
  if (blatt.getLastRow() === 0) {
    blatt.getRange(1, 1, 1, spalten.length).setValues([spalten]).setFontWeight('bold');
    blatt.setFrozenRows(1);
  }
  return blatt;
}

function zeilen_() {
  const daten = blatt_(BLATT_ABOS, SPALTEN).getDataRange().getValues();
  const kopf = daten[0];
  return daten.slice(1).map(z => {
    const o = {};
    kopf.forEach((k, i) => { o[k] = z[i]; });
    return o;
  });
}

function index_(kopf) {
  const o = {};
  kopf.forEach((k, i) => { o[k] = i; });
  return o;
}

function zaehlen_(reihen, feld, liste) {
  const z = {};
  reihen.forEach(r => {
    const werte = liste ? String(r[feld] || '').split(',').map(s => s.trim()) : [String(r[feld] || '').trim()];
    werte.filter(Boolean).forEach(w => { z[w] = (z[w] || 0) + 1; });
  });
  return z;
}

function entwurf_() {
  const daten = blatt_(BLATT_ENTWURF, ['feld', 'wert']).getDataRange().getValues().slice(1);
  const o = {};
  daten.forEach(z => { o[z[0]] = z[1]; });
  return o;
}

function filter_(text) {
  if (!text || String(text).indexOf('=') === -1) return null;
  const teile = String(text).split('=');
  return { spalte: teile[0].trim(), wert: teile.slice(1).join('=').trim() };
}

function abmeldelink_(token) {
  return webAppUrl_() + '?aktion=abmelden&token=' + encodeURIComponent(token);
}

function webAppUrl_() {
  return CONFIG.WEB_APP_URL || ScriptApp.getService().getUrl();
}

function sauber_(wert, max) {
  let s = String(wert == null ? '' : wert).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // verhindert Formeln im Tabellenblatt
  return s;
}

function esc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function zeit_(d) {
  return Utilities.formatDate(d, CONFIG.ZEITZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function isoWoche_(datum) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tag);
  const jahrStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { jahr: d.getUTCFullYear(), woche: Math.ceil(((d - jahrStart) / 864e5 + 1) / 7) };
}

function wochenName_(datum) {
  const w = isoWoche_(datum);
  return 'Woche ' + String(w.woche).padStart(2, '0') + ' ' + w.jahr;
}

function wochenStart_(datum) {
  const d = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
  const tag = d.getDay() || 7;
  d.setDate(d.getDate() - (tag - 1));
  return d;
}

function json_(objekt) {
  return ContentService.createTextOutput(JSON.stringify(objekt)).setMimeType(ContentService.MimeType.JSON);
}

function knopf_(url, text, zweitrangig) {
  return '<a class="knopf' + (zweitrangig ? ' zweit' : '') + '" href="' + esc_(url) + '" target="_top">' + esc_(text) + '</a>';
}

function seite_(titel, inhalt) {
  const html = '<!doctype html><html lang="de"><head><meta charset="utf-8"><style>' +
    'body{margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f4f1ea;color:#14213a}' +
    '.karte{max-width:460px;margin:8vh auto;background:#fff;border-radius:20px;padding:32px 24px;box-shadow:0 10px 30px rgba(20,33,58,.08)}' +
    'h1{font-family:Georgia,serif;font-size:26px;margin:0 0 12px}.gross{font-size:20px;font-weight:600}p{line-height:1.55}' +
    '.knopf{display:block;text-align:center;background:#14365c;color:#fff;padding:14px;border-radius:12px;text-decoration:none;font-weight:600;margin:10px 0}' +
    '.knopf.zweit{background:#fff;color:#14365c;border:1.5px solid #14365c}' +
    '</style></head><body><div class="karte"><h1>' + esc_(titel) + '</h1>' + inhalt + '</div></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(titel)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function meldung_(text) {
  Logger.log(text);
  try { SpreadsheetApp.getUi().alert(text); } catch (e) { /* ohne Oberfläche ausgeführt */ }
}
