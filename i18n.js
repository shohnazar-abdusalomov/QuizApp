
// i18n.js - Internationalization/Translation System
const i18n = (() => {
  const translations = {
    uzb: {
      welcome_back: "Xush kelibsiz,",
      username: "Foydalanuvchi nomi",
      enter_username: "Foydalanuvchi nomini kiriting",
      select_difficulty: "Qiyinlik darajasi",
      easy: "Oson",
      medium: "O'rtacha",
      hard: "Qiyin",
      game_settings: "O'yin sozlamalari",
      questions: "Savollar",
      time_question: "Savol uchun vaqt",
      difficulty: "Qiyinlik",
      category: "Kategoriya",
      language: "Til",
      any_category: "Har qanday kategoriya",
      start_quiz: "Testni boshlash",
      play: "O'ynash",
      rank: "Reyting",
      profile: "Profil",
      settings: "Sozlamalar",
      notifications: "Bildirishnomalar",
      no_notifications: "Yangi bildirishnomalar yo'q",
      weekly_challenge: "Haftalik musobaqa",
      leaderboard: "Reyting jadvali",
      top_3_scores: "Top 3 natijalar",
      no_scores_yet: "Hali natijalar yo'q",
      no_players_yet: "Hali o'yinchilar yo'q. Birinchi bo'ling!",
      games_played: "O'yinlar soni",
      highest_score: "Eng yuqori ball",
      average_score: "O'rtacha ball",
      total_xp: "Jami XP",
      back_to_leaderboard: "Reytingga qaytish",
      loading_questions: "Savollar yuklanmoqda...",
      question: "Savol",
      next: "Keyingisi",
      score: "Ball",
      results: "Natijalar",
      correct_answers: "To'g'ri javoblar",
      play_again: "Yana o'ynash",
      apply_settings: "Sozlamalarni saqlash",
      awesome: "Ajoyib! Siz zo'r natija ko'rsatdingiz 💥",
      great_job: "Ajoyib ish! 🎉",
      good_try: "Yaxshi harakat — mashq qiling! 🙂",
      try_again: "Yana urinib ko'ring 😄",
      sec: "son",
      xp: "XP"
    },
    eng: {
      welcome_back: "Welcome back,",
      username: "Username",
      enter_username: "Enter username",
      select_difficulty: "Select Difficulty",
      easy: "Easy",
      medium: "Medium",
      hard: "Hard",
      game_settings: "Game Settings",
      questions: "Questions",
      time_question: "Time/Question",
      difficulty: "Difficulty",
      category: "Category",
      language: "Language",
      any_category: "Any Category",
      start_quiz: "Start Quiz",
      play: "Play",
      rank: "Rank",
      profile: "Profile",
      settings: "Settings",
      notifications: "Notifications",
      no_notifications: "No new notifications",
      weekly_challenge: "Weekly Challenge",
      leaderboard: "Leaderboard",
      top_3_scores: "Top 3 Scores",
      no_scores_yet: "No scores yet",
      no_players_yet: "No players registered yet. Be the first!",
      games_played: "Games Played",
      highest_score: "Highest Score",
      average_score: "Average Score",
      total_xp: "Total XP",
      back_to_leaderboard: "Back to Leaderboard",
      loading_questions: "Loading questions...",
      question: "Question",
      next: "Next",
      score: "Score",
      results: "Results",
      correct_answers: "Correct Answers",
      play_again: "Play Again",
      apply_settings: "Apply Settings",
      awesome: "Awesome! You crushed it 💥",
      great_job: "Great job! 🎉",
      good_try: "Good try — keep practicing! 🙂",
      try_again: "Try Again 😄",
      sec: "sec",
      xp: "XP"
    },
    rus: {
      welcome_back: "С возвращением,",
      username: "Имя пользователя",
      enter_username: "Введите имя пользователя",
      select_difficulty: "Выберите сложность",
      easy: "Легко",
      medium: "Средне",
      hard: "Сложно",
      game_settings: "Настройки игры",
      questions: "Вопросы",
      time_question: "Время/Вопрос",
      difficulty: "Сложность",
      category: "Категория",
      language: "Язык",
      any_category: "Любая категория",
      start_quiz: "Начать тест",
      play: "Играть",
      rank: "Рейтинг",
      profile: "Профиль",
      settings: "Настройки",
      notifications: "Уведомления",
      no_notifications: "Нет новых уведомлений",
      weekly_challenge: "Недельный вызов",
      leaderboard: "Таблица лидеров",

      top_3_scores: "Топ 3 результата",
      no_scores_yet: "Пока нет результатов",
      no_players_yet: "Игроков пока нет. Будьте первым!",
      games_played: "Игр сыграно",
      highest_score: "Лучший результат",
      average_score: "Средний результат",
      total_xp: "Всего XP",
      back_to_leaderboard: "Вернуться к рейтингу",
      loading_questions: "Загрузка вопросов...",
      question: "Вопрос",
      next: "Далее",
      score: "Счет",
      results: "Результаты",
      correct_answers: "Правильные ответы",
      play_again: "Играть снова",
      apply_settings: "Применить настройки",
      awesome: "Потрясающе! Вы справились 💥",
      great_job: "Отличная работа! 🎉",
      good_try: "Хорошая попытка — продолжайте практиковаться! 🙂",
      try_again: "Попробуйте снова 😄",
      sec: "сек",
      xp: "XP"
    }
  };

  let currentLang = localStorage.getItem('quiz_language') || 'uzb';

  function t(key) {
    return translations[currentLang]?.[key] || translations.eng[key] || key;
  }

  function setLang(lang) {
    if (translations[lang]) {
      currentLang = lang;
      localStorage.setItem('quiz_language', lang);
      updatePageTranslations();
    }
  }

  function getLang() {
    return currentLang;
  }

  function updatePageTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        if (el.tagName === 'INPUT' && el.placeholder !== undefined) {
          el.placeholder = t(key);
        } else {
          el.textContent = t(key);
        }
      }
    });
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updatePageTranslations);
  } else {
    updatePageTranslations();
  }

  return { t, setLang, getLang, updatePageTranslations };
})();

// Make available globally
if (typeof window !== 'undefined') {
  window.i18n = i18n;
}
