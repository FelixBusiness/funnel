// Der Entscheidungsbaum des Funnels.
// Jede Frage hat eine id, einen Titel, Antworten und für jede Antwort das nächste Ziel ("weiter").
// Ändere hier Texte, Antworten und Pfade – an der Logik in index.html musst du nichts anpassen.
// Wichtig: Die Antworttexte landen 1:1 in der Datenbank. Wenn du sie später änderst,
// tauchen alte und neue Texte im Dashboard getrennt auf.

window.FUNNEL = {
  start: 'investiert',

  fragen: {
    investiert: {
      titel: 'Bist du bereits in Aktien investiert?',
      untertitel: 'Damit wir wissen, wo du gerade stehst.',
      typ: 'einfach',
      antworten: [
        { text: 'Ja, auch in Einzelaktien', symbol: '📈', weiter: 'nebenwerte' },
        { text: 'Ja, aber nur über Indexfonds oder Fonds', symbol: '🧺', weiter: 'horizont' },
        { text: 'Nein, noch nicht', symbol: '🌱', weiter: 'huerde' }
      ]
    },

    nebenwerte: {
      titel: 'Hast du schon Nebenwerte im Depot?',
      untertitel: 'Gemeint sind kleinere börsennotierte Unternehmen, etwa aus dem SDAX oder darunter.',
      typ: 'einfach',
      antworten: [
        { text: 'Ja, regelmäßig', symbol: '🎯', weiter: 'horizont' },
        { text: 'Ein paar', symbol: '🔍', weiter: 'horizont' },
        { text: 'Nein, noch nicht', symbol: '🚪', weiter: 'horizont' },
        { text: 'Was sind Nebenwerte?', symbol: '❓', weiter: 'horizont' }
      ]
    },

    huerde: {
      titel: 'Was hält dich bisher davon ab?',
      untertitel: 'Ehrlich ist gut – genau daraus machen wir Inhalte.',
      typ: 'einfach',
      antworten: [
        { text: 'Mir fehlt das Wissen', symbol: '📚', weiter: 'horizont' },
        { text: 'Mir fehlt die Zeit', symbol: '⏳', weiter: 'horizont' },
        { text: 'Ich weiß nicht, wem ich vertrauen kann', symbol: '🤝', weiter: 'horizont' },
        { text: 'Ich warte auf den richtigen Zeitpunkt', symbol: '⏱️', weiter: 'horizont' }
      ]
    },

    horizont: {
      titel: 'Für welchen Zeithorizont legst du an?',
      untertitel: 'Oder würdest du anlegen, falls du noch nicht investiert bist.',
      typ: 'einfach',
      antworten: [
        { text: 'Kurzfristig und opportunistisch', symbol: '⚡', weiter: 'themen' },
        { text: 'Mittelfristig (1 bis 5 Jahre)', symbol: '🧭', weiter: 'themen' },
        { text: 'Langfristig für die Rente', symbol: '🏔️', weiter: 'themen' },
        { text: 'Gemischt', symbol: '🔀', weiter: 'themen' }
      ]
    },

    themen: {
      titel: 'Welche Themen interessieren dich am meisten?',
      untertitel: 'Mehrere Antworten möglich.',
      typ: 'mehrfach',
      weiter: 'wunsch',
      antworten: [
        { text: 'Deutsche Nebenwerte', symbol: '🇩🇪' },
        { text: 'Dividenden', symbol: '💶' },
        { text: 'Wachstum und Technologie', symbol: '🚀' },
        { text: 'Sondersituationen', symbol: '🧩', hinweis: 'Übernahmen, Abspaltungen' },
        { text: 'Bewertung verstehen lernen', symbol: '🧮' },
        { text: 'Makro und Zinsen', symbol: '🌍' }
      ]
    },

    wunsch: {
      titel: 'Welche Aktie sollen wir uns als Nächstes anschauen?',
      untertitel: 'Ein Unternehmen, eine Branche oder eine Frage – alles willkommen.',
      typ: 'text',
      platzhalter: 'z. B. Hensoldt, Dividendenstrategien, …',
      weiter: 'premium',
      ueberspringbar: true
    },

    premium: {
      titel: 'Wir planen ausführliche Einzelanalysen als Premium-Angebot. Interessiert?',
      untertitel: 'Unverbindlich – du bekommst nur Bescheid, wenn es losgeht.',
      typ: 'einfach',
      antworten: [
        { text: 'Ja, setz mich auf die Warteliste', symbol: '✋', weiter: 'ergebnis' },
        { text: 'Vielleicht später', symbol: '🤔', weiter: 'ergebnis' },
        { text: 'Nein, der Gratis-Newsletter reicht mir', symbol: '👍', weiter: 'ergebnis' }
      ]
    }
  },

  // Ergebnisprofil: beschreibt, welche INHALTE passen – nie, welche Anlage passt (keine Anlageberatung).
  profil: function (a) {
    const themen = a.themen || [];
    if (a.investiert === 'Nein, noch nicht') {
      return {
        name: 'Der Einsteiger mit Plan',
        text: 'Du willst verstehen, bevor du investierst. Genau so sollte man anfangen.',
        punkte: [
          'Jede Woche ein kurzes Lernstück: wie man ein Unternehmen liest',
          'Eine Idee der Woche, Schritt für Schritt erklärt',
          'Keine Fachbegriffe ohne Erklärung'
        ]
      };
    }
    if (a.horizont === 'Kurzfristig und opportunistisch' || themen.indexOf('Sondersituationen') > -1) {
      return {
        name: 'Der Chancen-Jäger',
        text: 'Du suchst Situationen, die der Markt noch nicht eingepreist hat.',
        punkte: [
          'Sondersituationen und Katalysatoren im Blick',
          'Unsere Positionen im öffentlichen Musterportfolio',
          'Klare Einordnung von Chancen und Risiken'
        ]
      };
    }
    if (a.horizont === 'Langfristig für die Rente' || themen.indexOf('Dividenden') > -1) {
      return {
        name: 'Der geduldige Vermögensaufbauer',
        text: 'Du denkst in Jahren, nicht in Tagen – und suchst Qualität zu einem fairen Preis.',
        punkte: [
          'Qualitätsunternehmen abseits der großen Indizes',
          'Dividenden und Bilanzqualität verständlich eingeordnet',
          'Ein wöchentlicher Blick aufs große Ganze'
        ]
      };
    }
    return {
      name: 'Der Nebenwerte-Entdecker',
      text: 'Du willst wissen, was abseits von DAX und Nasdaq passiert.',
      punkte: [
        'Deutsche Nebenwerte, die kaum jemand auf dem Schirm hat',
        'Kurze, fundierte Einschätzungen statt Börsenlärm',
        'Updates zum öffentlichen Musterportfolio'
      ]
    };
  }
};
