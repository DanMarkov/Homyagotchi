window.__FR_UNITS__ = {
  "units": [
    {
      "id": "les_bases",
      "emoji": "🇫🇷",
      "color": "#4cc3f7",
      "title_ru": "Основы",
      "title_en": "The basics",
      "title_fr": "Les bases",
      "lessons": [
        {
          "id": "l1_salutations",
          "title_ru": "Приветствия",
          "title_en": "Greetings",
          "title_fr": "Les salutations",
          "exercises": [
            {
              "type": "choice",
              "prompt": "w_bonjour",
              "dir": "fr2ru",
              "options": [
                "w_bonjour",
                "w_salut",
                "w_merci",
                "w_au_revoir"
              ]
            },
            {
              "type": "choice",
              "prompt": "w_merci",
              "dir": "ru2fr",
              "options": [
                "w_salut",
                "w_merci",
                "w_oui",
                "w_au_revoir"
              ]
            },
            {
              "type": "listen",
              "prompt": "w_salut",
              "options": [
                "w_salut",
                "w_bonjour",
                "w_au_revoir"
              ]
            },
            {
              "type": "build",
              "prompt": "ph_bonjour_merci",
              "chips": [
                "w_bonjour",
                "w_merci",
                "w_salut",
                "w_oui"
              ]
            },
            {
              "type": "match",
              "ids": [
                "w_bonjour",
                "w_salut",
                "w_merci",
                "w_au_revoir",
                "w_svp"
              ]
            },
            {
              "type": "choice",
              "prompt": "w_au_revoir",
              "dir": "fr2ru",
              "options": [
                "w_merci",
                "w_salut",
                "w_au_revoir",
                "w_bonjour"
              ]
            }
          ]
        },
        {
          "id": "l2_nombres",
          "title_ru": "Числа 1–10",
          "title_en": "Numbers 1–10",
          "title_fr": "Les nombres 1–10",
          "exercises": [
            {
              "type": "choice",
              "prompt": "w_un",
              "dir": "fr2ru",
              "options": [
                "w_un",
                "w_deux",
                "w_trois",
                "w_quatre"
              ]
            },
            {
              "type": "choice",
              "prompt": "w_cinq",
              "dir": "ru2fr",
              "options": [
                "w_quatre",
                "w_cinq",
                "w_six",
                "w_sept"
              ]
            },
            {
              "type": "listen",
              "prompt": "w_sept",
              "options": [
                "w_sept",
                "w_six",
                "w_huit"
              ]
            },
            {
              "type": "match",
              "ids": [
                "w_un",
                "w_deux",
                "w_trois",
                "w_cinq",
                "w_dix"
              ]
            },
            {
              "type": "choice",
              "prompt": "w_dix",
              "dir": "fr2ru",
              "options": [
                "w_neuf",
                "w_dix",
                "w_huit",
                "w_sept"
              ]
            },
            {
              "type": "build",
              "prompt": "ph_un_deux_trois",
              "chips": [
                "w_trois",
                "w_un",
                "w_deux",
                "w_quatre",
                "w_cinq"
              ]
            }
          ]
        },
        {
          "id": "l3_presentation",
          "title_ru": "«Je m'appelle» и вежливость",
          "title_en": "“Je m'appelle” & politeness",
          "title_fr": "« Je m'appelle » et la politesse",
          "exercises": [
            {
              "type": "choice",
              "prompt": "w_je",
              "dir": "ru2fr",
              "options": [
                "w_je",
                "w_un",
                "w_merci",
                "w_salut"
              ]
            },
            {
              "type": "choice",
              "prompt": "w_mappelle",
              "dir": "fr2ru",
              "options": [
                "w_mappelle",
                "w_je",
                "w_merci",
                "w_deux"
              ]
            },
            {
              "type": "build",
              "prompt": "ph_je_mappelle",
              "chips": [
                "w_mappelle",
                "w_anna",
                "w_je",
                "w_bonjour",
                "w_merci"
              ]
            },
            {
              "type": "listen",
              "prompt": "w_svp",
              "options": [
                "w_svp",
                "w_merci",
                "w_oui"
              ]
            },
            {
              "type": "choice",
              "prompt": "w_svp",
              "dir": "fr2ru",
              "options": [
                "w_svp",
                "w_merci",
                "w_salut",
                "w_trois"
              ]
            },
            {
              "type": "match",
              "ids": [
                "w_je",
                "w_mappelle",
                "w_anna",
                "w_merci",
                "w_svp"
              ]
            },
            {
              "type": "build",
              "prompt": "ph_salut_revoir",
              "chips": [
                "w_au_revoir",
                "w_salut",
                "w_bonjour",
                "w_oui"
              ]
            }
          ]
        }
      ]
    }
  ]
};
