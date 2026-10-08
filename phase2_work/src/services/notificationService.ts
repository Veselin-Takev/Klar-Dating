import { askAICoach } from "../lib/api";
import { fetchDatePlans } from "../lib/datePlans";
import { getUserStorageItem, klarStorage } from "../lib/userScopedStorage";

export class NotificationService {
  static async requestPermission() {
    if ("Notification" in window) {
      try {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
          await Notification.requestPermission();
        }
      } catch (e) {
        console.warn("Notification permission request failed", e);
      }
    }
  }

  static sendPushNotification(title: string, options?: NotificationOptions) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, options);
    } else {
      // Fallback for iframe / denied permission: Dispatch a custom event to show an in-app toast
      const event = new CustomEvent('klar-in-app-notification', {
        detail: { title, body: options?.body }
      });
      window.dispatchEvent(event);
    }
  }


  static notifyMilestoneUnlocked(badgeName: string) {
    this.sendPushNotification("Meilenstein erreicht! 🏆", {
      body: `Herzlichen Glückwunsch! Du hast den Badge "${badgeName}" freigeschaltet.`
    });
  }

  static async checkUpcomingDates() {
    try {
      const dates = await fetchDatePlans();
      const notifiedDatesRaw = klarStorage.getItem('klar_notified_dates');
      const notifiedDates: string[] = notifiedDatesRaw ? JSON.parse(notifiedDatesRaw) : [];

      const now = new Date().getTime();
      const twoHoursInMs = 2 * 60 * 60 * 1000;

      let newNotified = false;

      for (const d of dates) {
        const dateObj = new Date(d.date).getTime();
        const timeDiff = dateObj - now;

        // 30-minute warning for Safety Check
        const thirtyMinsInMs = 30 * 60 * 1000;
        if (timeDiff > 0 && timeDiff <= thirtyMinsInMs && !notifiedDates.includes(d.id + "_30m_safety")) {
          // If the date might be in a public place, ask to activate safety button
          const ideaStr = (d.idea || "").toLowerCase();
          const isPublic = ideaStr.includes("park") || ideaStr.includes("caf") || ideaStr.includes("bar") || ideaStr.includes("restaurant") || ideaStr.includes("spaziergang");

          if (isPublic) {
            if ("Notification" in window && Notification.permission === "granted") {
              const notif = new Notification("Date an öffentlichem Ort 🛡️", {
                body: `Dein Date startet in 30 Minuten. Möchtest du den Sicherheits-Modus aktivieren?`
              });
              notif.onclick = () => { window.location.href = '/safety'; };
            } else {
              this.sendPushNotification("Date an öffentlichem Ort 🛡️", {
                body: `Dein Date startet in 30 Minuten. Vergiss nicht, bei Bedarf den Sicherheits-Modus zu aktivieren.`
              });
            }
          }
          notifiedDates.push(d.id + "_30m_safety");
          newNotified = true;
        }

        // 15-minute warning for Dating-Rituals
        const fifteenMinsInMs = 15 * 60 * 1000;
        if (timeDiff > 0 && timeDiff <= fifteenMinsInMs && !notifiedDates.includes(d.id + "_15m")) {
          if ("Notification" in window && Notification.permission === "granted") {
            const notif = new Notification("Date rückt näher! ⏳", {
              body: "Dein Date startet in 15 Minuten. Nimm dir kurz Zeit für ein beruhigendes Dating-Ritual. Hier tippen!"
            });
            notif.onclick = () => { window.location.href = '/rituals'; };
          } else {
            this.sendPushNotification("Date rückt näher! ⏳", {
              body: "Dein Date startet in 15 Minuten. Nimm dir kurz Zeit für ein beruhigendes Dating-Ritual."
            });
          }
          notifiedDates.push(d.id + "_15m");
          newNotified = true;
        }

        // If date is in the future but within 2 hours, and not yet notified
        if (timeDiff > 0 && timeDiff <= twoHoursInMs && !notifiedDates.includes(d.id)) {
          let notificationBody = `In weniger als 2 Stunden steht dein Date an! Thema: ${d.idea}.`;

          try {
             // Retrieve mood and interests to personalize the AI prompt
             const savedMoodRaw = klarStorage.getItem('klar_daily_mood');
             const savedMood = savedMoodRaw ? JSON.parse(savedMoodRaw).mood : 'Neutral';

             const savedInterests = getUserStorageItem("userInterests");
             const userInterests = savedInterests ? JSON.parse(savedInterests).join(", ") : "Nicht angegeben";

             const prompt = `Ich habe in 2 Stunden ein Date mit ${d.matchName}. Mein aktueller Mood ist: ${savedMood}. Meine Interessen: ${userInterests}. Die Date-Idee ist: ${d.idea}. Gib mir einen super kurzen, motivierenden Tipp für mein Mindset und 1-2 lockere, situationsbezogene Icebreaker. Halte dich extrem kurz, maximal 3 Sätze insgesamt.`;

             const response = await askAICoach(prompt);
             notificationBody = `Dein Date mit ${d.matchName} steht an! \n\nKI-Coach Tipp:\n${response}`;
          } catch(err) {
             console.warn('AI Coach failed to generate reminder tip', err);
          }

          this.sendPushNotification(`Date mit ${d.matchName} ☕`, {
            body: notificationBody
          });
          notifiedDates.push(d.id);
          newNotified = true;
        }
      }

      if (newNotified) {
        klarStorage.setItem('klar_notified_dates', JSON.stringify(notifiedDates));
      }
    } catch (e) {
      console.warn("Error checking upcoming dates:", e);
    }
  }

  static promptDateReflection(dateName: string) {
    this.sendPushNotification("Wie lief es? 🤔", {
      body: `Dein Date '${dateName}' ist vorbei. Nimm dir kurz 2 Minuten Zeit, um deine Eindrücke im Tagebuch festzuhalten.`
    });
  }


    static checkCoachImpulse() {
    try {
      const lastImpulse = klarStorage.getItem('klar_last_coach_impulse');
      const now = Date.now();
      const lastTime = lastImpulse ? parseInt(lastImpulse, 10) : 0;

      // We will send if it has been more than a few hours for testing, or we can just send it based on sentiment
      if (now - lastTime > 24 * 60 * 60 * 1000 || !lastImpulse) {

        let randomImpulse = "Authentizität gewinnt: Sei ganz du selbst, das ist attraktiv! ✨";
        let title = "Klar Coach Impuls 💡";

        // Sentiment-based impulses
        const historyRaw = klarStorage.getItem('klar_chat_sentiment_history');
        if (historyRaw) {
          const history = JSON.parse(historyRaw);
          if (history.length > 0) {
            // Sort to get the latest
            const latest = history.sort((a: unknown, b: unknown) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

            if (latest.sentiment === 'negative') {
              title = "Coach-Tipp für zähe Chats 💡";
              randomImpulse = "Dein letzter Chat lief eher schleppend. Versuch's beim nächsten Mal mit einer unerwarteten Frage wie: 'Was war dein Highlight diese Woche?'";
            } else if (latest.sentiment === 'neutral') {
              title = "Bring Spannung in den Chat 💡";
              randomImpulse = "Dein letztes Gespräch war okay, aber es fehlte der Funke. Trau dich, etwas persönlicher zu werden oder ein bisschen zu flirten!";
            } else if (latest.sentiment === 'positive') {
              title = "Nutze das Momentum! 🔥";
              randomImpulse = "Dein letztes Gespräch lief super! Wenn ihr weiter auf einer Wellenlänge seid, schlag doch bald ein lockeres Date (z.B. Kaffee) vor.";
            }
          }
        } else {
          const impulses = [
            "Authentizität gewinnt: Sei ganz du selbst, das ist attraktiv! ✨",
            "Zuhören ist die halbe Miete: Stell offene Fragen beim nächsten Date. 🗣️",
            "Klarheit: Weißt du schon, was du wirklich willst? Nimm dir Zeit zur Reflexion. 🧠"
          ];
          randomImpulse = impulses[Math.floor(0 * impulses.length)] || "Authentizität gewinnt!";
        }

        this.sendPushNotification(title, {
          body: randomImpulse
        });
        klarStorage.setItem('klar_last_coach_impulse', now.toString());
      }
    } catch (e) {
      console.warn("Error checking coach impulse:", e);
    }
  }

  static triggerProactiveImpulse() {
      // Force trigger for demo/UI purposes
      klarStorage.setItem('klar_last_coach_impulse', '0');
      this.checkCoachImpulse();
  }

    static checkDiaryInactivity() {
    try {
      const journalsRaw = klarStorage.getItem("klar_dating_journals");
      const journals = journalsRaw ? JSON.parse(journalsRaw) : [];
      let lastEntryTime = 0;

      if (journals.length > 0) {
        lastEntryTime = Math.max(...journals.map((j: unknown) => j.timestamp));
      } else {
        // Fallback to app start time if never logged
        const initial = klarStorage.getItem('klar_app_install_time');
        if (!initial) {
          klarStorage.setItem('klar_app_install_time', Date.now().toString());
          lastEntryTime = Date.now();
        } else {
          lastEntryTime = parseInt(initial, 10);
        }
      }

      const now = Date.now();
      const daysPassed = (now - lastEntryTime) / (1000 * 60 * 60 * 24);

      if (daysPassed > 3) {
        const lastReminder = klarStorage.getItem('klar_last_diary_reminder');
        const lastReminderTime = lastReminder ? parseInt(lastReminder, 10) : 0;

        // Remind max once per 24 hours
        if (now - lastReminderTime > 24 * 60 * 60 * 1000) {
          // Check coaching progress for context
          const completedStepsRaw = klarStorage.getItem('klar_dating_roadmap');
          const completedSteps = completedStepsRaw ? JSON.parse(completedStepsRaw) : [];

          let bodyMsg = "Du hast schon seit 3 Tagen kein Mood-Update gemacht. Lass deine Gefühle nicht unter den Teppich kehren!";
          if (completedSteps.includes('step-3')) {
            bodyMsg = "Du arbeitest gerade hart an deiner Resilienz. Reflektiere deine Stimmung im Tagebuch, das hilft enorm!";
          } else if (completedSteps.includes('step-1')) {
            bodyMsg = "Dein Profil steht, aber wie fühlst du dich beim Dating? Ein kurzes Mood-Update bringt Klarheit.";
          }

          this.sendPushNotification("Zeit für ein Mood-Update! 📖", {
            body: bodyMsg
          });
          klarStorage.setItem('klar_last_diary_reminder', now.toString());
        }
      }
    } catch (e) {
      console.warn("Error checking diary inactivity:", e);
    }
  }

  static checkMilestoneInactivity() {
    try {
      const lastEngagement = klarStorage.getItem('klar_last_milestone_engagement');
      if (lastEngagement) {
        const lastTime = parseInt(lastEngagement, 10);
        const now = Date.now();
        const hoursPassed = (now - lastTime) / (1000 * 60 * 60);

        if (hoursPassed > 48) {
          const lastReminder = klarStorage.getItem('klar_last_milestone_reminder');
          const lastReminderTime = lastReminder ? parseInt(lastReminder, 10) : 0;

          // Only remind once per 24 hours after the 48 hour threshold
          if (now - lastReminderTime > 24 * 60 * 60 * 1000) {
            this.sendPushNotification("Erinnere dich an deine Ziele! 🎯", {
              body: "Du hast schon eine Weile nicht mehr an deinen Dating-Meilensteinen gearbeitet. Bleib dran!"
            });
            klarStorage.setItem('klar_last_milestone_reminder', now.toString());
          }
        }
      } else {
         // Initialize if empty
         klarStorage.setItem('klar_last_milestone_engagement', Date.now().toString());
      }
    } catch (e) {
      console.warn("Error checking milestone inactivity:", e);
    }
  }


  static checkRitualInactivity() {
    try {
      const lastEngagement = klarStorage.getItem('klar_last_ritual_engagement');
      if (lastEngagement) {
        const lastTime = parseInt(lastEngagement, 10);
        const now = Date.now();
        const hoursPassed = (now - lastTime) / (1000 * 60 * 60);

        if (hoursPassed > 48) {
          const lastReminder = klarStorage.getItem('klar_last_ritual_reminder');
          const lastReminderTime = lastReminder ? parseInt(lastReminder, 10) : 0;

          if (now - lastReminderTime > 24 * 60 * 60 * 1000) {
            this.sendPushNotification("Zeit für eine kurze Atemübung? 🧘‍♂️", {
              body: "Du hast die Dating Rituale länger nicht genutzt. Gönn dir eine Minute Ruhe, um fokussiert zu bleiben."
            });
            klarStorage.setItem('klar_last_ritual_reminder', now.toString());
          }
        }
      } else {
         klarStorage.setItem('klar_last_ritual_engagement', Date.now().toString());
      }
    } catch (e) {
      console.warn("Error checking ritual inactivity:", e);
    }
  }

  static checkRituals() {
    this.checkRitualInactivity();
  }

  // Helper for testing

  static simulateInactivity() {
    const pastTime = Date.now() - (49 * 60 * 60 * 1000);
    klarStorage.setItem('klar_last_milestone_engagement', pastTime.toString());
    klarStorage.removeItem('klar_last_milestone_reminder');
    this.checkMilestoneInactivity();
  }
}
