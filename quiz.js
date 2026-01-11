// Quiz Game Logic with Translation Support
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const decodeHTML = (html) => {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
  };

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Translation cache to avoid repeated API calls
  const translationCache = {};

  // Translate text using MyMemory API (free, no API key needed)
  async function translateText(text, targetLang) {
    if (!text || targetLang === 'eng') return text; // English is source
    
    const cacheKey = `${text}_${targetLang}`;
    if (translationCache[cacheKey]) {
      return translationCache[cacheKey];
    }

    // Language codes for MyMemory API
    const langMap = {
      'uzb': 'uz-UZ',
      'eng': 'en-US',
      'rus': 'ru-RU'
    };

    const sourceLang = 'en-US';
    const targetLangCode = langMap[targetLang] || 'en-US';

    if (sourceLang === targetLangCode) return text;

    try {
      const encodedText = encodeURIComponent(text);
      const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${sourceLang}|${targetLangCode}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.responseStatus === 200 && data.responseData.translatedText) {
        const translated = data.responseData.translatedText;
        translationCache[cacheKey] = translated;
        return translated;
      }
      
      return text; // Return original if translation fails
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  }

  // Batch translate multiple texts with delay to avoid rate limiting
  async function translateBatch(texts, targetLang) {
    if (!texts || texts.length === 0) return texts;
    if (targetLang === 'eng') return texts;

    const results = [];
    for (let i = 0; i < texts.length; i++) {
      const translated = await translateText(texts[i], targetLang);
      results.push(translated);
      // Small delay to avoid rate limiting (MyMemory allows 100 requests/day for free)
      if (i < texts.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    return results;
  }

  // State
  let state = {
    username: null,
    questions: [],
    current: 0,
    score: 0,
    correctCount: 0,
    timerId: null,
    timeLeft: 10,
    timePerQuestion: 10,
    settings: {
      amount: 10,
      difficulty: "medium",
      category: "any",
      time: 10,
      language: "uzb",
    },
  };

  const SCORE_MAP = { easy: 0.5, medium: 1, hard: 1.5 };

  // Sound Effects
  function playCorrectSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(1200, now + 0.1);
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function playIncorrectSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.setValueAtTime(200, now + 0.15);
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function playWarningSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioContext.currentTime;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(500, now + 0.1);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  const LS = {
    username: "quiz_username",
    settings: "quiz_settings",
    topScores: "quiz_top_scores_v1",
  };

  // API
  async function fetchCategories() {
    try {
      const res = await fetch("https://opentdb.com/api_category.php");
      const data = await res.json();
      return data.trivia_categories || [];
    } catch (err) {
      console.error("Failed to fetch categories", err);
      return [];
    }
  }

  async function fetchQuestions({ amount, difficulty, category }) {
    const params = new URLSearchParams();
    params.set("amount", amount);
    if (difficulty && difficulty !== "any") params.set("difficulty", difficulty);
    if (category && category !== "any") params.set("category", category);
    params.set("type", "multiple");

    const url = `https://opentdb.com/api.php?${params.toString()}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.results) return [];

    return data.results.map((q) => {
      const all = [q.correct_answer, ...q.incorrect_answers].map(decodeHTML);
      const shuffled = shuffle(all.slice());
      return {
        question: decodeHTML(q.question),
        correct: decodeHTML(q.correct_answer),
        answers: shuffled,
        difficulty: q.difficulty,
        category: q.category,
        // Store original English versions
        questionOriginal: decodeHTML(q.question),
        correctOriginal: decodeHTML(q.correct_answer),
        answersOriginal: shuffled.slice(),
      };
    });
  }

  // Translate questions
  async function translateQuestions(questions, targetLang) {
    if (!questions || questions.length === 0) return questions;
    if (targetLang === 'eng') return questions;

    const qText = $("#questionText");
    if (qText) {
      const loadingMsg = window.i18n ? window.i18n.t('loading_questions') : 'Loading questions...';
      qText.innerHTML = `${loadingMsg}<br><span class="text-xs text-muted-foreground">Translating...</span>`;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      // Translate question
      q.question = await translateText(q.questionOriginal, targetLang);
      
      // Translate all answers
      const translatedAnswers = await translateBatch(q.answersOriginal, targetLang);
      q.answers = translatedAnswers;
      
      // Find correct answer in translated answers
      const correctIndex = q.answersOriginal.indexOf(q.correctOriginal);
      if (correctIndex !== -1) {
        q.correct = translatedAnswers[correctIndex];
      }

      // Progress indicator
      if (qText && i < questions.length - 1) {
        const progress = Math.round(((i + 1) / questions.length) * 100);
        qText.innerHTML = `Translating... ${progress}%`;
      }
      
      // Small delay between questions to avoid overwhelming the API
      if (i < questions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return questions;
  }

  // UI Bindings
  function bindHomePage() {
    const startBtn = $("#startQuizBtn");
    const usernameInput = $("#usernameInput");
    if (!startBtn || !usernameInput) return;

    startBtn.addEventListener("click", (e) => {
      const name = usernameInput.value && usernameInput.value.trim();
      if (!name) {
        usernameInput.focus();
        usernameInput.classList.add("ring-2", "ring-destructive");
        setTimeout(() => usernameInput.classList.remove("ring-2", "ring-destructive"), 800);
        return;
      }
      localStorage.setItem(LS.username, name);
      const saved = localStorage.getItem(LS.settings);
      if (!saved) {
        localStorage.setItem(LS.settings, JSON.stringify(state.settings));
      }
      window.location.href = "play---quiz.html";
    });
  }

  async function bindPlayPage() {
    const qText = $("#questionText");
    const timerNumber = $("#timerNumber");
    const answerBtns = $$(".answer-btn");
    const nextBtn = $("#nextBtn");
    const scoreDisplay = $("#scoreDisplay");
    const progressText = $("#progressText");
    const applySettingsBtn = $("#applySettingsBtn");
    const settingAmount = $("#settingAmount");
    const settingDifficulty = $("#settingDifficulty");
    const settingCategory = $("#settingCategory");
    const settingTime = $("#settingTime");
    const settingLanguage = $("#settingLanguage");
    const topScoresList = $("#topScoresList");
    const timerRing = document.getElementById("timerRing");
    let ringCircumference = null;
    let ringAnimId = null;

    const settingsModal = document.getElementById("settingsModal");
    const top3Modal = document.getElementById("top3Modal");
    const settingsToggleBtn = document.getElementById("settingsToggleBtn");
    const top3ToggleBtn = document.getElementById("top3ToggleBtn");
    const closeSettingsBtn = document.getElementById("closeSettingsBtn");
    const closeTop3Btn = document.getElementById("closeTop3Btn");
    const progressBarsContainer = document.getElementById("progressBars");

    state.username = localStorage.getItem(LS.username) || "Player";

    try {
      const saved = JSON.parse(localStorage.getItem(LS.settings) || "{}");
      state.settings = Object.assign({}, state.settings, saved);
    } catch (e) {}

    if (settingAmount) settingAmount.value = String(state.settings.amount);
    if (settingDifficulty) settingDifficulty.value = state.settings.difficulty;
    if (settingTime) settingTime.value = String(state.settings.time);
    if (settingLanguage) settingLanguage.value = state.settings.language || 'uzb';

    const categories = await fetchCategories();
    if (settingCategory) {
      const anyText = window.i18n ? window.i18n.t('any_category') : 'Any Category';
      settingCategory.innerHTML = `<option value="any">${anyText}</option>`;
      categories.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.name;
        settingCategory.appendChild(opt);
      });
      if (state.settings.category && state.settings.category !== "any") {
        settingCategory.value = String(state.settings.category);
      }
    }

    // Modal handlers
    if (settingsToggleBtn && settingsModal) {
      settingsToggleBtn.addEventListener("click", () => {
        settingsModal.classList.toggle("hidden");
      });
    }
    if (closeSettingsBtn && settingsModal) {
      closeSettingsBtn.addEventListener("click", () => {
        settingsModal.classList.add("hidden");
      });
    }
    if (top3ToggleBtn && top3Modal) {
      top3ToggleBtn.addEventListener("click", () => {
        top3Modal.classList.toggle("hidden");
      });
    }
    if (closeTop3Btn && top3Modal) {
      closeTop3Btn.addEventListener("click", () => {
        top3Modal.classList.add("hidden");
      });
    }

    if (settingsModal) {
      settingsModal.addEventListener("click", (e) => {
        if (e.target === settingsModal) settingsModal.classList.add("hidden");
      });
    }
    if (top3Modal) {
      top3Modal.addEventListener("click", (e) => {
        if (e.target === top3Modal) top3Modal.classList.add("hidden");
      });
    }

    function setScoreDisplay() {
      if (scoreDisplay) scoreDisplay.textContent = String(state.score.toFixed(1));
    }

    function setProgress() {
      if (progressText) {
        const qLabel = window.i18n ? window.i18n.t('question') : 'Question';
        progressText.innerHTML = `<span data-i18n="question">${qLabel}</span> ${state.current + 1} / ${state.questions.length}`;
      }
    }

    function renderProgressBars() {
      if (!progressBarsContainer || !state.questions.length) return;
      progressBarsContainer.innerHTML = "";
      const total = state.questions.length;
      for (let i = 0; i < total; i++) {
        const bar = document.createElement("div");
        const isCompleted = i < state.current;
        const isCurrent = i === state.current;
        bar.className = `h-2 flex-1 rounded-full transition-all ${
          isCompleted
            ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"
            : isCurrent
            ? "bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
            : "bg-white/20"
        }`;
        progressBarsContainer.appendChild(bar);
      }
    }

    function disableAnswers(value = true) {
      answerBtns.forEach((b) => (b.disabled = value));
    }

    function clearAnswerStyles() {
      answerBtns.forEach((b) => {
        b.classList.remove("bg-green-600", "bg-red-600", "text-white", "opacity-40");
      });
    }

    function showNextButton(show = true) {
      if (!nextBtn) return;
      nextBtn.classList.toggle("hidden", !show);
    }

    function stopTimer() {
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
      }
      if (ringAnimId) {
        cancelAnimationFrame(ringAnimId);
        ringAnimId = null;
      }
    }

    function startTimer() {
      stopTimer();
      state.timeLeft = state.timePerQuestion;
      updateTimerDisplay();
      const endTs = Date.now() + state.timePerQuestion * 1000;
      if (timerRing && !ringCircumference) {
        const r = Number(timerRing.getAttribute("r")) || 32;
        ringCircumference = 2 * Math.PI * r;
        timerRing.style.strokeDasharray = String(ringCircumference);
      }

      let lastWarningTime = -1;
      state.timerId = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((endTs - Date.now()) / 1000));
        state.timeLeft = remaining;
        updateTimerDisplay();

        if (state.timeLeft <= 5 && state.timeLeft > 0 && state.timeLeft !== lastWarningTime) {
          playWarningSound();
          lastWarningTime = state.timeLeft;
        }

        if (state.timeLeft <= 0) {
          stopTimer();
          revealCorrectNoPoints();
        }
      }, 250);

      function animate() {
        const now = Date.now();
        const remMs = Math.max(0, endTs - now);
        const ratio = remMs / (state.timePerQuestion * 1000);
        if (timerRing && ringCircumference !== null) {
          const offset = ringCircumference * (1 - ratio);
          timerRing.style.strokeDashoffset = String(offset);
        }
        if (remMs > 0) {
          ringAnimId = requestAnimationFrame(animate);
        } else {
          ringAnimId = null;
        }
      }
      animate();
    }

    function updateTimerDisplay() {
      if (!timerNumber) return;
      const timerDisplay = document.getElementById("timerDisplay");
      timerNumber.textContent = String(state.timeLeft);
      timerNumber.classList.add("text-3xl", "font-black");

      if (state.timeLeft <= 3 && state.timeLeft > 0) {
        timerNumber.classList.add("text-red-600");
        if (timerDisplay) {
          const flashCycle = Math.floor((Date.now() / 300) % 2);
          timerDisplay.style.opacity = flashCycle === 0 ? "1" : "0.4";
        }
      } else {
        timerNumber.classList.remove("text-red-600");
        if (timerDisplay) timerDisplay.style.opacity = "1";
      }
    }

    function revealCorrectNoPoints() {
      const q = state.questions[state.current];
      if (!q) return;
      disableAnswers(true);
      clearAnswerStyles();
      answerBtns.forEach((btn) => {
        const text = (btn.dataset.answer || "").trim();
        if (text === q.correct) {
          btn.classList.add("bg-green-600", "text-white");
        } else {
          btn.classList.add("opacity-60");
        }
      });
      showNextButton(true);
    }

    function handleAnswerClick(e) {
      const btn = e.currentTarget;
      if (!btn || btn.disabled) return;
      stopTimer();
      disableAnswers(true);
      const selected = (btn.dataset.answer || "").trim();
      const q = state.questions[state.current];
      clearAnswerStyles();
      if (selected === q.correct) {
        playCorrectSound();
        btn.classList.add("bg-green-600", "text-white");
        const pts = SCORE_MAP[q.difficulty] || SCORE_MAP[state.settings.difficulty] || 1;
        state.score = +(state.score + pts).toFixed(2);
        state.correctCount += 1;
        setScoreDisplay();
      } else {
        playIncorrectSound();
        btn.classList.add("bg-red-600", "text-white");
        answerBtns.forEach((b) => {
          if ((b.dataset.answer || "").trim() === q.correct) {
            b.classList.add("bg-green-600", "text-white");
          } else if (b !== btn) {
            b.classList.add("opacity-60");
          }
        });
      }
      showNextButton(true);
    }

    answerBtns.forEach((btn) => {
      btn.addEventListener("click", handleAnswerClick);
    });

    nextBtn && nextBtn.addEventListener("click", () => {
      state.current += 1;
      if (state.current >= state.questions.length) {
        showResults();
      } else {
        renderQuestion();
      }
    });

    applySettingsBtn && applySettingsBtn.addEventListener("click", async () => {
      const newSettings = {
        amount: Number(settingAmount.value || 10),
        difficulty: settingDifficulty.value || "medium",
        category: settingCategory.value || "any",
        time: Number(settingTime.value || 10),
        language: settingLanguage.value || "uzb",
      };
      state.settings = newSettings;
      localStorage.setItem(LS.settings, JSON.stringify(newSettings));
      if (settingLanguage && window.i18n) {
        window.i18n.setLang(settingLanguage.value || "uzb");
      }
      if (settingsModal) settingsModal.classList.add("hidden");
      await loadQuestionsAndStart();
    });

    async function loadQuestionsAndStart() {
      state.current = 0;
      state.score = 0;
      state.correctCount = 0;
      state.timePerQuestion = state.settings.time;
      setScoreDisplay();
      showNextButton(false);
      clearAnswerStyles();
      const loadingMsg = window.i18n ? window.i18n.t('loading_questions') : 'Loading questions...';
      qText && (qText.textContent = loadingMsg);
      
      state.questions = await fetchQuestions({
        amount: state.settings.amount,
        difficulty: state.settings.difficulty,
        category: state.settings.category,
      });
      
      if (!state.questions.length) {
        qText && (qText.textContent = "No questions available. Try different settings.");
        return;
      }

      // Translate questions if language is not English
      const targetLang = state.settings.language || 'uzb';
      if (targetLang !== 'eng') {
        state.questions = await translateQuestions(state.questions, targetLang);
      }

      renderQuestion();
      displayTopScores();
    }

    function renderQuestion() {
      stopTimer();
      clearAnswerStyles();
      disableAnswers(false);
      showNextButton(false);
      renderProgressBars();
      const q = state.questions[state.current];
      if (!q) return;
      if (qText) qText.innerHTML = q.question;
      
      const LETTERS = ["A", "B", "C", "D"];
      answerBtns.forEach((btn, idx) => {
        const answerText = q.answers[idx] || "";
        const content = btn.querySelector(".absolute.inset-0.flex");
        if (content) {
          content.innerHTML = `<span class="text-base font-bold text-foreground text-center px-2">${answerText}</span>`;
        } else {
          btn.textContent = answerText;
        }
        btn.dataset.answer = answerText;
        const badge = btn.querySelector("div > span");
        if (badge) {
          badge.textContent = LETTERS[idx] || "";
        }
      });
      setProgress();
      state.timePerQuestion = Number(settingTime?.value || state.settings.time || 10);
      state.timeLeft = state.timePerQuestion;
      if (timerNumber) timerNumber.textContent = String(state.timeLeft);
      startTimer();
    }

    function showResults() {
      stopTimer();
      const overlay = document.createElement("div");
      overlay.className = "fixed inset-0 bg-black/60 flex items-center justify-center z-60";
      const card = document.createElement("div");
      card.className = "w-[min(640px,95%)] bg-card/90 backdrop-blur-lg p-8 rounded-3xl text-center";
      
      const title = document.createElement("h2");
      title.className = "text-3xl font-black mb-2";
      title.textContent = window.i18n ? window.i18n.t('results') : 'Results';
      
      const scoreEl = document.createElement("p");
      scoreEl.className = "text-xl font-bold mb-2";
      const scoreLabel = window.i18n ? window.i18n.t('score') : 'Score';
      scoreEl.textContent = `${scoreLabel}: ${state.score.toFixed(1)}`;
      
      const correctEl = document.createElement("p");
      correctEl.className = "text-sm text-muted-foreground mb-4";
      const correctLabel = window.i18n ? window.i18n.t('correct_answers') : 'Correct Answers';
      correctEl.textContent = `${correctLabel}: ${state.correctCount} / ${state.questions.length}`;

      const msg = document.createElement("p");
      msg.className = "text-lg font-semibold mb-6";
      const pct = state.correctCount / Math.max(1, state.questions.length);
      if (pct >= 0.85) msg.textContent = window.i18n ? window.i18n.t('awesome') : "Awesome! You crushed it 💥";
      else if (pct >= 0.6) msg.textContent = window.i18n ? window.i18n.t('great_job') : "Great job! 🎉";
      else if (pct >= 0.35) msg.textContent = window.i18n ? window.i18n.t('good_try') : "Good try — keep practicing! 🙂";
      else msg.textContent = window.i18n ? window.i18n.t('try_again') : "Try Again 😄";

      const playAgainBtn = document.createElement("button");
      playAgainBtn.className = "px-6 py-3 bg-accent text-white rounded-2xl font-bold";
      playAgainBtn.textContent = window.i18n ? window.i18n.t('play_again') : 'Play Again';
      playAgainBtn.addEventListener("click", async () => {
        document.body.removeChild(overlay);
        await loadQuestionsAndStart();
      });

      card.appendChild(title);
      card.appendChild(scoreEl);
      card.appendChild(correctEl);
      card.appendChild(msg);
      card.appendChild(playAgainBtn);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      saveTopScore({ name: state.username || "Player", score: state.score });
      displayTopScores();
    }

    function getTopScores() {
      try {
        return JSON.parse(localStorage.getItem(LS.topScores) || "[]");
      } catch (e) {
        return [];
      }
    }

    function saveTopScore(entry) {
      const arr = getTopScores();
      arr.push(entry);
      arr.sort((a, b) => b.score - a.score);
      const top = arr.slice(0, 3);
      localStorage.setItem(LS.topScores, JSON.stringify(top));
    }

    function displayTopScores() {
      const list = getTopScores();
      if (!topScoresList) return;
      topScoresList.innerHTML = "";
      list.forEach((r, i) => {
        const el = document.createElement("div");
        el.className = "flex items-center justify-between gap-3 p-2 bg-white/5 rounded-lg";
        el.innerHTML = `<div class="flex items-center gap-2"><span class="text-primary font-black">#${i + 1}</span><strong class="text-foreground truncate">${r.name}</strong></div><div class="text-accent font-bold">${Number(r.score).toFixed(1)}</div>`;
        topScoresList.appendChild(el);
      });
      if (!list.length) {
        const noScoresMsg = window.i18n ? window.i18n.t('no_scores_yet') : 'No scores yet';
        topScoresList.innerHTML = `<div class="text-xs text-muted-foreground text-center py-4">${noScoresMsg}</div>`;
      }
    }

    await loadQuestionsAndStart();
  }

  // Init
  document.addEventListener("DOMContentLoaded", () => {
    bindHomePage();
    if (document.getElementById("questionText")) {
      bindPlayPage();
    }
    const homeTop = document.getElementById("topScoresList");
    if (homeTop && !document.getElementById("questionText")) {
      try {
        const list = JSON.parse(localStorage.getItem(LS.topScores) || "[]");
        homeTop.innerHTML = "";
        if (!list.length) {
          const noScoresMsg = window.i18n ? window.i18n.t('no_scores_yet') : 'No scores yet';
          homeTop.innerHTML = `<div class="text-xs text-muted-foreground">${noScoresMsg}</div>`;
        }
        list.forEach((r, i) => {
          const el = document.createElement("div");
          el.className = "flex items-center justify-between gap-2";
          el.innerHTML = `<div class="truncate"><strong class="text-foreground">${i + 1}. ${r.name}</strong></div><div class="text-accent font-bold">${Number(r.score).toFixed(1)}</div>`;
          homeTop.appendChild(el);
        });
      } catch (e) {}
    }
  });
})();