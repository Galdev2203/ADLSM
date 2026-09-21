const WIDTH = 1080;
const HEIGHT = 1920;
const MAX_MATCHES_PER_PAGE = 8;

const COLORS = {
  blue: '#2455a4',
  darkBlue: '#173f80',
  yellow: '#ffe000',
  white: '#ffffff',
  mutedBlue: '#5f78a4',
  softWhite: '#f7f8fb'
};

const FONTS = {
  title: 'Georgia, Times New Roman, serif',
  body: 'Trebuchet MS, Arial, sans-serif'
};

const DEFAULT_TEMPLATE = {
  title: 'HORARIOS BALONCESTO',
  subtitle: 'FEDERADOS'
};

export function getTemplatePages(matches) {
  const pages = [];
  for (let i = 0; i < matches.length; i += MAX_MATCHES_PER_PAGE) {
    pages.push(matches.slice(i, i + MAX_MATCHES_PER_PAGE));
  }
  return pages;
}

export function createTemplateCanvas(matches, template = DEFAULT_TEMPLATE) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  drawTemplate(canvas, matches, template);
  return canvas;
}

export function drawTemplate(canvas, matches, template = DEFAULT_TEMPLATE) {
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / WIDTH;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  drawBackground(ctx);
  drawHeader(ctx, template);

  const count = Math.min(matches.length, MAX_MATCHES_PER_PAGE);
  if (count) {
    const contentTop = 292;
    const contentBottom = 1818;
    const rowHeight = 171;
    const availableHeight = contentBottom - contentTop;
    const totalRowsHeight = count * rowHeight;

    // The cards always keep the same height. Only the vertical spacing changes
    // so the block fills the available area for any number of selected matches.
    const gap = count > 1
      ? Math.max(12, (availableHeight - totalRowsHeight) / (count - 1))
      : 0;
    const blockHeight = totalRowsHeight + gap * Math.max(0, count - 1);
    const startY = count === 1
      ? contentTop + (availableHeight - rowHeight) / 2
      : contentTop + Math.max(0, (availableHeight - blockHeight) / 2);

    for (let index = 0; index < count; index += 1) {
      drawMatch(ctx, matches[index], startY + index * (rowHeight + gap), rowHeight);
    }
  }

  ctx.restore();
}

function drawBackground(ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, '#6f84a8');
  gradient.addColorStop(.45, '#59729e');
  gradient.addColorStop(1, '#435f8f');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.globalAlpha = .06;
  for (let y = 0; y < HEIGHT; y += 90) {
    for (let x = (y / 90 % 2) * 45; x < WIDTH; x += 90) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
}

function drawHeader(ctx, template) {
  const title = cleanTeamName(template?.title) || DEFAULT_TEMPLATE.title;
  const subtitle = cleanTeamName(template?.subtitle) || DEFAULT_TEMPLATE.subtitle;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.yellow;

  const titleLines = fitTitleLines(ctx, title.toUpperCase(), 850);
  const titleSize = titleLines.length === 1 ? 70 : 60;
  const titleLineHeight = titleSize + 8;
  const titleStartY = titleLines.length === 1 ? 92 : 62;
  ctx.font = `italic 700 ${titleSize}px ${FONTS.title}`;
  titleLines.forEach((line, index) => {
    ctx.fillText(line, WIDTH / 2, titleStartY + index * titleLineHeight);
  });

  const subtitleY = titleLines.length === 1 ? 166 : 192;
  roundRect(ctx, 126, subtitleY, 828, 54, 0, COLORS.white);
  ctx.fillStyle = COLORS.blue;
  fitText(ctx, subtitle.toUpperCase(), WIDTH / 2, subtitleY + 27, 770, 30, 'center', 9, 700);
}

function fitTitleLines(ctx, text, maxWidth) {
  ctx.font = `italic 700 64px ${FONTS.title}`;
  if (ctx.measureText(text).width <= maxWidth) return [text];

  const words = text.split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2);
}

function drawMatch(ctx, match, y, rowHeight) {
  const x = 104;
  const w = 872;
  const centerX = WIDTH / 2;
  const circleY = y + 67;
  const circleR = 49;
  const timeR = 57;

  roundRect(ctx, x, y, w, rowHeight, 30, COLORS.white);
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(x + 32, y, w - 64, 7);

  const info = `${formatCompetition(match.competition)}${match.venue ? ` / ${formatVenue(match.venue)}` : ''}`;
  const pillW = Math.min(720, Math.max(390, measurePillWidth(ctx, info)));
  roundRect(ctx, centerX - pillW / 2, y + rowHeight - 30, pillW, 45, 23, COLORS.yellow);
  ctx.fillStyle = COLORS.blue;
  fitText(ctx, info.toUpperCase(), centerX, y + rowHeight - 7, pillW - 34, 15, 'center', 8, 700);

  drawBadge(ctx, 178, circleY, circleR, match.homeTeam, true);
  drawBadge(ctx, 902, circleY, circleR, match.awayTeam, false);

  drawTeamName(ctx, match.homeTeam, 250, circleY, 150, false);
  drawTeamName(ctx, match.awayTeam, 830, circleY, 150, true);

  ctx.beginPath();
  ctx.arc(centerX, circleY, timeR, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.yellow;
  ctx.fill();

  ctx.fillStyle = COLORS.blue;
  fitText(ctx, match.time || '--:--', centerX, circleY - 9, 100, 29, 'center', 9, 800);
  fitText(ctx, formatDay(match.date), centerX, circleY + 24, 100, 12, 'center', 8, 700);
}

function drawBadge(ctx, x, y, r, team, isHome) {
  ctx.beginPath();
  ctx.arc(x, y, r + 7, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.white;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = isHome ? COLORS.blue : COLORS.softWhite;
  ctx.fill();

  ctx.fillStyle = isHome ? COLORS.yellow : COLORS.blue;
  fitText(ctx, isHome ? 'ADLSM' : initials(team), x, y - 4, 78, 21, 'center', 8, 800);
  fitText(ctx, isHome ? 'BALONCESTO' : 'RIVAL', x, y + 21, 76, 10, 'center', 7, 700);
}

function drawTeamName(ctx, value, x, y, maxWidth, right) {
  const text = cleanTeamName(value) || 'SIN EQUIPO';
  let size = 23;
  while (size > 16) {
    ctx.font = `700 ${size}px ${FONTS.body}`;
    const lines = wrapText(ctx, text, maxWidth, 2);
    if (lines.every(line => ctx.measureText(line).width <= maxWidth)) break;
    size -= 1;
  }

  ctx.fillStyle = COLORS.blue;
  ctx.textAlign = right ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, text, maxWidth, 2);
  const lineHeight = size * 1.18;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight));
}

function wrapText(ctx, text, maxWidth, maxLines = 2) {
  const words = text.split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 3 && ctx.measureText(`${last}…`).width > maxWidth) {
    last = last.slice(0, -1);
  }
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

function fitText(ctx, text, x, y, maxWidth, initialSize, align = 'center', minSize = 8, weight = 700) {
  let size = initialSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${FONTS.body}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function roundRect(ctx, x, y, w, h, r, fill) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function initials(team = '') {
  const words = cleanTeamName(team).split(' ').filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map(word => word[0]).join('').toUpperCase();
}

function cleanTeamName(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}

function formatCompetition(value = '') {
  return cleanTeamName(value) || 'BALONCESTO FEDERADO';
}

function formatVenue(value = '') {
  return cleanTeamName(value).replace(/^PISTA\s*:?\s*/i, '');
}

function formatDay(value = '') {
  if (!value) return '';

  let date;
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const european = String(value).match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);

  if (iso) {
    date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12));
  } else if (european?.[3]) {
    date = new Date(Date.UTC(Number(european[3]), Number(european[2]) - 1, Number(european[1]), 12));
  } else {
    return '';
  }

  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' }).format(date).toUpperCase();
}

function measurePillWidth(ctx, text) {
  ctx.font = `700 15px ${FONTS.body}`;
  return ctx.measureText(text.toUpperCase()).width + 42;
}

export { WIDTH, HEIGHT, MAX_MATCHES_PER_PAGE, DEFAULT_TEMPLATE };
