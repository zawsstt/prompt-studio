/* ============================================
   PromptStudio 滚动联动系统升级方案
   基于 SKILL 要求重构：
   1. 移除 window.scroll 监听，改用 IntersectionObserver
   2. 移除 "Scroll to explore" 提示
   3. 系统化的滚动叙事联动
   4. 保留克制的视差效果
   ============================================ */

// ========== A. 滚动内容联动系统 ==========

class ScrollNarrative {
  constructor() {
    this.sections = new Map();
    this.activeSection = null;
    this.navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
    this.progressBar = document.getElementById('progress');

    this.init();
  }

  init() {
    this.setupSectionObservers();
    this.setupProgressTracking();
    this.setupNavigation();
    this.setupReducedMotion();
  }

  // 核心：章节进入视口联动
  setupSectionObservers() {
    const sections = document.querySelectorAll('section[id], .trust, .cta-final');

    // 当前章节追踪（用于导航高亮）
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.activateSection(entry.target.id);
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: '-20% 0px -60% 0px' // 中心区域触发
      }
    );

    sections.forEach(section => {
      navObserver.observe(section);

      // 特定章节的叙事联动
      this.setupSectionNarrative(section);
    });
  }

  // 激活当前章节（导航高亮）
  activateSection(sectionId) {
    if (this.activeSection === sectionId) return;
    this.activeSection = sectionId;

    this.navLinks.forEach(link => {
      const href = link.getAttribute('href').slice(1);
      link.classList.toggle('on', href === sectionId);
    });
  }

  // 为特定章节设置叙事联动
  setupSectionNarrative(section) {
    const id = section.id;

    switch(id) {
      case 'loop':
        this.setupLoopNarrative(section);
        break;
      case 'diff':
        this.setupDiffNarrative(section);
        break;
      case 'trust-panel':
        this.setupTrustNarrative(section);
        break;
      case 'providers':
        this.setupProvidersNarrative(section);
        break;
      case 'versions':
        this.setupVersionsNarrative(section);
        break;
    }
  }

  // 工作闭环：步骤依次激活
  setupLoopNarrative(section) {
    const steps = section.querySelectorAll('.loop-step');
    if (!steps.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            // 级联延迟激活
            setTimeout(() => {
              entry.target.classList.add('active');
            }, index * 150);
          }
        });
      },
      { threshold: 0.6, rootMargin: '-10% 0px' }
    );

    steps.forEach(step => observer.observe(step));
  }

  // Diff 对比：行级变更块逐步显现
  setupDiffNarrative(section) {
    const diffBlocks = section.querySelectorAll('.diff-line');
    if (!diffBlocks.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, index) => {
          if (entry.isIntersecting) {
            const delay = index * 80; // 新增、删除、替换依次出现
            setTimeout(() => {
              entry.target.classList.add('highlight');
            }, delay);
          }
        });
      },
      { threshold: 0.7 }
    );

    diffBlocks.forEach(block => observer.observe(block));
  }

  // 信任机制：说明面板滑入
  setupTrustNarrative(section) {
    const detailPanel = section.querySelector('.detail-panel');
    if (!detailPanel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              detailPanel.classList.add('slide-in');
            }, 200);
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(section);
  }

  // 多模型接入：供应商标识依次出现
  setupProvidersNarrative(section) {
    const providers = section.querySelectorAll('.prov');
    if (!providers.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const provs = Array.from(entry.target.querySelectorAll('.prov'));
            provs.forEach((prov, i) => {
              setTimeout(() => {
                prov.style.opacity = '1';
                prov.style.transform = 'translateY(0)';
              }, i * 60);
            });
          }
        });
      },
      { threshold: 0.6 }
    );

    observer.observe(section);
  }

  // 版本沉淀：时间线节点逐个点亮
  setupVersionsNarrative(section) {
    const timelineNodes = section.querySelectorAll('.tl-node');
    if (!timelineNodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            timelineNodes.forEach((node, i) => {
              setTimeout(() => {
                node.classList.add('lit');
              }, i * 180);
            });
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(section);
  }

  // 滚动进度条（使用 IntersectionObserver 替代 scroll 监听）
  setupProgressTracking() {
    const sections = document.querySelectorAll('section[id]');
    const totalSections = sections.length;
    let passedSections = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.8) {
            passedSections++;
          } else if (!entry.isIntersecting && entry.boundingClientRect.top > 0) {
            passedSections = Math.max(0, passedSections - 1);
          }

          const progress = (passedSections / totalSections) * 100;
          this.progressBar.style.width = `${Math.min(progress, 100)}%`;
        });
      },
      { threshold: [0, 0.8, 1] }
    );

    sections.forEach(section => observer.observe(section));
  }

  // 导航点击平滑滚动
  setupNavigation() {
    this.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').slice(1);
        const targetSection = document.getElementById(targetId);

        if (targetSection) {
          // 使用原生 scrollIntoView，尊重 scroll-behavior: smooth
          targetSection.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });

    // Logo 点击回到顶部
    const logo = document.querySelector('.nav-logo');
    if (logo) {
      logo.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  // 尊重 prefers-reduced-motion
  setupReducedMotion() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.scrollBehavior = 'auto';

      // 禁用所有延迟动画
      document.querySelectorAll('[data-delay]').forEach(el => {
        el.style.transitionDelay = '0s';
      });
    }
  }
}

// ========== B. 增强的 Reveal 系统 ==========

class RevealOnScroll {
  constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            this.observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.06,
        rootMargin: '0px 0px -5% 0px'
      }
    );

    this.init();
  }

  init() {
    // 普通 reveal 元素
    document.querySelectorAll('.reveal').forEach(el => {
      this.observer.observe(el);
    });

    // 带延迟的 reveal
    document.querySelectorAll('[data-delay]').forEach(el => {
      const delay = parseInt(el.getAttribute('data-delay')) || 0;
      el.style.transitionDelay = `${delay * 0.12}s`;
      this.observer.observe(el);
    });

    // 安全网：1.5s 后强制显示视口内未触发的元素
    setTimeout(() => {
      this.forceTriggerVisible();
    }, 1500);
  }

  forceTriggerVisible() {
    document.querySelectorAll('.reveal:not(.in), [data-ltr]:not(.in)').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add('in');
      }
    });
  }
}

// ========== C. 字母行进效果（保留） ==========

class LetterMarch {
  constructor() {
    this.init();
  }

  init() {
    document.querySelectorAll('[data-ltr]').forEach(el => {
      const html = el.innerHTML;
      el.innerHTML = '';
      this.splitLetters(el, html);
      this.observeLetters(el);
    });
  }

  splitLetters(container, html) {
    const units = [];
    const CJK = /[㐀-鿿豈-﫿぀-ヿ가-힯]/;
    const LATIN = /[A-Za-z0-9]/;

    const isGradEl = el => {
      if (el.getAttribute && (el.getAttribute('class') || '').includes('txt-grad')) return true;
      const style = window.getComputedStyle(el);
      return style.backgroundClip === 'text' || style.webkitBackgroundClip === 'text';
    };

    const gradParent = isGradEl(container);

    const pushUnit = (parent, text, grad) => {
      const s = document.createElement('span');
      s.className = 'ltr' + (grad ? ' ltr-grad' : '');
      s.textContent = text;
      s.style.transform = `translateX(${((units.length % 10) + 1) * 5}px)`;
      s.style.transitionDelay = (units.length * 0.032).toFixed(3) + 's';
      parent.appendChild(s);
      units.push(s);
    };

    const walk = (parent, node, grad) => {
      if (node.nodeType === 3) {
        let buf = '';
        const flush = () => {
          if (buf) {
            pushUnit(parent, buf, grad);
            buf = '';
          }
        };

        for (const ch of node.data) {
          if (LATIN.test(ch)) {
            buf += ch;
            continue;
          }
          flush();
          if (ch === ' ') {
            parent.appendChild(document.createTextNode(' '));
          } else {
            pushUnit(parent, ch, grad);
          }
        }
        flush();
      } else if (node.nodeName === 'BR') {
        parent.appendChild(document.createElement('br'));
      } else if (node.nodeType === 1) {
        const w = document.createElement(node.nodeName);
        if (node.getAttribute('class')) {
          w.setAttribute('class', node.getAttribute('class'));
        }
        parent.appendChild(w);
        node.childNodes.forEach(c => walk(w, c, grad || isGradEl(node)));
      }
    };

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.body.childNodes.forEach(n => walk(container, n, gradParent));

    return units;
  }

  observeLetters(container) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -6% 0px'
      }
    );

    observer.observe(container);
  }
}

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
  // 检测功能支持
  const supportsIO = 'IntersectionObserver' in window;

  if (!supportsIO) {
    console.warn('IntersectionObserver not supported, falling back to instant reveals');
    document.querySelectorAll('.reveal, [data-ltr]').forEach(el => {
      el.classList.add('in');
    });
    return;
  }

  // 初始化三大系统
  new ScrollNarrative();  // 滚动叙事联动
  new RevealOnScroll();   // 渐进显现
  new LetterMarch();      // 字母行进

  console.log('✅ PromptStudio 滚动联动系统已就绪');
});

// ========== 导出供调试使用 ==========
window.PromptStudioScroll = {
  ScrollNarrative,
  RevealOnScroll,
  LetterMarch
};
