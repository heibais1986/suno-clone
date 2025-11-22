import { Song, Language } from "./types";

export const TRANSLATIONS = {
  en: {
    navbar: {
      title: "Creative Studio",
      showcase: "Showcase",
      create: "Create",
      library: "Library",
      about: "About",
      searchPlaceholder: "Search songs...",
      signup: "Sign up",
      login: "Log in",
    },
    hero: {
      intro: "Introducing v3 Alpha",
      prefix: "Make a song about",
      prompts: [
        "a heartbroken robot",
        "a cyberpunk city rain",
        "a cat exploring space",
        "a summer road trip",
        "late night coding"
      ],
      description: "From your mind to music. We are building a future where anyone can make great music. Powered by advanced audio generation models.",
    },
    create: {
      placeholder: "Describe the song you want to create... (e.g. 'A sad song about a robot in the rain')",
      mode: "Mode",
      custom: "Custom",
      instrumental: "Instrumental",
      model: "Model",
      button: "Create",
      creating: "Creating...",
    },
    app: {
      trending: "Trending",
      global: "Global",
      japan: "Japan",
      usa: "USA",
      loadMore: "Load More",
      lyricsTitle: "Generated Lyrics",
      complete: "Complete",
    },
    player: {
      lyrics: "LYRICS"
    },
    auth: {
      loginTitle: "Welcome back",
      signupTitle: "Create an account",
      email: "Email address",
      password: "Password",
      submitLogin: "Log in",
      submitSignup: "Sign up",
      toggleToSignup: "Don't have an account? Sign up",
      toggleToLogin: "Already have an account? Log in",
      success: "Account created successfully!",
      error: "Something went wrong."
    }
  },
  zh: {
    navbar: {
      title: "创意工作室",
      showcase: "精选",
      create: "创作",
      library: "曲库",
      about: "关于",
      searchPlaceholder: "搜索歌曲...",
      signup: "注册",
      login: "登录",
    },
    hero: {
      intro: "v3 Alpha 版本介绍",
      prefix: "创作一首关于",
      prompts: [
        "失恋的机器人",
        "赛博朋克的雨夜",
        "探索宇宙的猫咪",
        "夏日的海边公路",
        "深夜写代码的快乐"
      ],
      description: "从灵感到旋律。我们正在构建一个任何人都能创作伟大音乐的未来。由先进的 Gemini 音频生成模型驱动。",
    },
    create: {
      placeholder: "描述你想创作的歌曲... (例如：'一首关于机器人在雨中哭泣的悲伤歌曲')",
      mode: "模式",
      custom: "自定义",
      instrumental: "纯音乐",
      model: "模型",
      button: "创作",
      creating: "创作中...",
    },
    app: {
      trending: "热门推荐",
      global: "全球",
      japan: "日本",
      usa: "美国",
      loadMore: "加载更多",
      lyricsTitle: "生成歌词",
      complete: "完成",
    },
    player: {
      lyrics: "歌词"
    },
    auth: {
      loginTitle: "欢迎回来",
      signupTitle: "创建账户",
      email: "电子邮箱",
      password: "密码",
      submitLogin: "登录",
      submitSignup: "注册",
      toggleToSignup: "还没有账户？去注册",
      toggleToLogin: "已有账户？去登录",
      success: "账户创建成功！",
      error: "发生了一些错误。"
    }
  }
};

// Using a free creative commons audio sample for demonstration
const DEMO_AUDIO = "https://cdn.freesound.org/previews/719/719349_5034008-lq.mp3";

const SAMPLE_SONGS_EN: Song[] = [
  {
    id: "1",
    title: "Neon Horizons",
    artist: "CyberDreamer",
    imageUrl: "https://picsum.photos/seed/neon/400/400",
    style: "Synthwave • Chill",
    duration: "3:20",
    plays: 145000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "2",
    title: "Midnight Rain",
    artist: "Lofi Study Girl",
    imageUrl: "https://picsum.photos/seed/rain/400/400",
    style: "Lofi Hip Hop",
    duration: "2:15",
    plays: 89000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "3",
    title: "Electric Soul",
    artist: "The Volts",
    imageUrl: "https://picsum.photos/seed/electric/400/400",
    style: "Funk • Electronic",
    duration: "4:05",
    plays: 23000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "4",
    title: "Deep Blue",
    artist: "Oceania",
    imageUrl: "https://picsum.photos/seed/ocean/400/400",
    style: "Ambient • Deep House",
    duration: "5:12",
    plays: 12000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "5",
    title: "Urban Jungle",
    artist: "Concrete Roots",
    imageUrl: "https://picsum.photos/seed/urban/400/400",
    style: "Drum & Bass",
    duration: "3:45",
    plays: 67000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "6",
    title: "Starlight Ballad",
    artist: "Lunar Voice",
    imageUrl: "https://picsum.photos/seed/star/400/400",
    style: "Orchestral Pop",
    duration: "3:30",
    plays: 210000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "7",
    title: "Glitch Protocol",
    artist: "Null Pointer",
    imageUrl: "https://picsum.photos/seed/glitch/400/400",
    style: "Hyperpop • Glitchcore",
    duration: "2:05",
    plays: 45000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "8",
    title: "Desert Wind",
    artist: "Sahara Sounds",
    imageUrl: "https://picsum.photos/seed/desert/400/400",
    style: "World • Acoustic",
    duration: "4:10",
    plays: 32000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "9",
    title: "Cyber Punk 2099",
    artist: "Night City",
    imageUrl: "https://picsum.photos/seed/punk/400/400",
    style: "Industrial Rock",
    duration: "3:55",
    plays: 98000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "10",
    title: "Golden Hour",
    artist: "Sun Chaser",
    imageUrl: "https://picsum.photos/seed/gold/400/400",
    style: "Indie Pop",
    duration: "3:15",
    plays: 156000,
    audioUrl: DEMO_AUDIO
  }
];

const SAMPLE_SONGS_ZH: Song[] = [
  {
    id: "1",
    title: "霓虹天际",
    artist: "赛博造梦者",
    imageUrl: "https://picsum.photos/seed/neon/400/400",
    style: "合成波 • 治愈",
    duration: "3:20",
    plays: 145000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "2",
    title: "午夜霖铃",
    artist: "Lofi 学习女孩",
    imageUrl: "https://picsum.photos/seed/rain/400/400",
    style: "低保真嘻哈",
    duration: "2:15",
    plays: 89000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "3",
    title: "电流灵魂",
    artist: "伏特乐队",
    imageUrl: "https://picsum.photos/seed/electric/400/400",
    style: "放克 • 电子",
    duration: "4:05",
    plays: 23000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "4",
    title: "湛蓝深海",
    artist: "大洋洲",
    imageUrl: "https://picsum.photos/seed/ocean/400/400",
    style: "氛围 • 深宅",
    duration: "5:12",
    plays: 12000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "5",
    title: "都市丛林",
    artist: "混凝土根源",
    imageUrl: "https://picsum.photos/seed/urban/400/400",
    style: "鼓与贝斯",
    duration: "3:45",
    plays: 67000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "6",
    title: "星光叙事曲",
    artist: "月之声",
    imageUrl: "https://picsum.photos/seed/star/400/400",
    style: "管弦流行",
    duration: "3:30",
    plays: 210000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "7",
    title: "故障协议",
    artist: "空指针",
    imageUrl: "https://picsum.photos/seed/glitch/400/400",
    style: "超流行 • 故障核",
    duration: "2:05",
    plays: 45000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "8",
    title: "大漠风吟",
    artist: "撒哈拉之音",
    imageUrl: "https://picsum.photos/seed/desert/400/400",
    style: "世界音乐 • 原声",
    duration: "4:10",
    plays: 32000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "9",
    title: "赛博朋克 2099",
    artist: "夜之城",
    imageUrl: "https://picsum.photos/seed/punk/400/400",
    style: "工业摇滚",
    duration: "3:55",
    plays: 98000,
    audioUrl: DEMO_AUDIO
  },
  {
    id: "10",
    title: "金色时刻",
    artist: "追日者",
    imageUrl: "https://picsum.photos/seed/gold/400/400",
    style: "独立流行",
    duration: "3:15",
    plays: 156000,
    audioUrl: DEMO_AUDIO
  }
];

export const getSampleSongs = (language: Language) => {
  return language === 'zh' ? SAMPLE_SONGS_ZH : SAMPLE_SONGS_EN;
};