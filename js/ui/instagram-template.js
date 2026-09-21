const WIDTH = 1080;
const HEIGHT = 1920;
const MAX_MATCHES_PER_PAGE = 5;

const COLORS = {
  blue: '#2455a4',
  darkBlue: '#173f80',
  yellow: '#ffe000',
  white: '#ffffff',
  mutedBlue: '#5f78a4'
};

export function getTemplatePages(matches) {
  const pages = [];
  for (let i = 0; i < matches.length; i += MAX_MATCHES_PER_PAGE) {
    pages.push(matches.slice(i, i + MAX_MATCHES_PER_PAGE));
  }
  return pages;
}

export function createTemplateCanvas(matches) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  drawTemplate(canvas, matches);
  return canvas;
}

export function drawTemplate(canvas, matches) {
  const ctx = canvas.getContext('2d');
  const scale = canvas.width / WIDTH;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  drawBackground(ctx);
  drawHeader(ctx);

  const count = Math.min(matches.length, MAX_MATCHES_PER_PAGE);
  if (count) {
    const top = 305;
    const gap = 22;
    const rowHeight = count <= 4 ? 270 : 252;
    for (let index = 0; index < count; index += 1) {
      drawMatch(ctx, matches[index], top + index * (rowHeight + gap), rowHeight);
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

  ctx.globalAlpha = .08;
  for (let y = 0; y < HEIGHT; y += 90) {
    for (let x = (y / 90 % 2) * 45; x < WIDTH; x += 90) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 3, 3);
    }
  }
  ctx.globalAlpha = 1;
}

function drawHeader(ctx) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = COLORS.yellow;
  ctx.font = 'italic 900 72px Georgia, serif';
  ctx.fillText('HORARIOS', WIDTH / 2, 92);
  ctx.fillText('BALONCESTO', WIDTH / 2, 168);

  roundRect(ctx, 126, 206, 828, 58, 0, COLORS.white);
  ctx.fillStyle = COLORS.blue;
  ctx.font = '900 32px Arial, sans-serif';
  ctx.fillText('FEDERADOS', WIDTH / 2, 236);
}

function drawMatch(ctx, match, y, rowHeight) {
  const x = 104;
  const w = 872;
  const centerX = WIDTH / 2;
  const timeX = centerX;
  const circleY = y + 88;
  const circleR = 74;
  const timeR = 78;

  // White match body with yellow top accent.
  roundRect(ctx, x, y, w, rowHeight, 34, COLORS.white);
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(x + 34, y, w - 68, 8);

  // Bottom information pill.
  const info = `${formatCompetition(match.competition)}${match.venue ? ` / ${formatVenue(match.venue)}` : ''}`;
  const pillW = Math.min(720, Math.max(430, measurePillWidth(ctx, info)));
  roundRect(ctx, centerX - pillW / 2, y + rowHeight - 31, pillW, 52, 26, COLORS.yellow);
  ctx.fillStyle = COLORS.blue;
  ctx.font = '900 18px Arial, sans-serif';
  fitText(ctx, info.toUpperCase(), centerX, y + rowHeight - 5, pillW - 42, 18, 'center');

  // Team badges.
  drawBadge(ctx, 196, circleY, circleR, match.homeTeam, true);
  drawBadge(ctx, 884, circleY, circleR, match.awayTeam, false);

  // Team names.
  drawTeamName(ctx, match.homeTeam, 306, circleY, 190, false);
  drawTeamName(ctx, match.awayTeam, 774, circleY, 190, true);

  // Time/day circle.
  ctx.beginPath();
  ctx.arc(timeX, circleY, timeR, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.yellow;
  ctx.fill();

  ctx.fillStyle = COLORS.blue;
  ctx.font = '900 39px Arial, sans-serif';
  ctx.fillText(match.time || '--:--', timeX, circleY - 14);
  ctx.font = '900 18px Arial, sans-serif';
  ctx.fillText(formatDay(match.date), timeX, circleY + 25);
}

function drawBadge(ctx, x, y, r, team, isHome) {
  ctx.beginPath();
  ctx.arc(x, y, r + 10, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.white;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = isHome ? COLORS.blue : '#f7f7f7';
  ctx.fill();

  ctx.fillStyle = isHome ? COLORS.yellow : COLORS.blue;
  ctx.font = '900 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isHome ? 'ADLSM' : initials(team), x, y - 3);
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText(isHome ? 'BALONCESTO' : 'RIVAL', x, y + 27);
}

function drawTeamName(ctx, value, x, y, maxWidth, right) {
  ctx.fillStyle = COLORS.blue;
  ctx.textAlign = right ? 'right' : 'left';
  ctx.font = '900 27px Arial, sans-serif';
  const lines = wrapText(ctx, cleanTeamName(value), maxWidth, 2);
  const startY = y - ((lines.length - 1) * 17);
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * 38));
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
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(1, 24 - kept[maxLines - 1].length))}…`;
  return kept;
}

function fitText(ctx, text, x, y, maxWidth, initialSize, align = 'center') {
  let size = initialSize;
  while (size > 12) {
    ctx.font = `900 ${size}px Arial, sans-serif`;
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
  return value.replace(/\s+/g, ' ').trim();
}

function formatCompetition(value = '') {
  return cleanTeamName(value) || 'BALONCESTO FEDERADO';
}

function formatVenue(value = '') {
  return cleanTeamName(value).replace(/^PISTA\s*:?\s*/i, '');
}

function formatDay(value = '') {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date).toUpperCase();
}

function measurePillWidth(ctx, text) {
  ctx.font = '900 18px Arial, sans-serif';
  return ctx.measureText(text.toUpperCase()).width + 54;
}

export { WIDTH, HEIGHT, MAX_MATCHES_PER_PAGE };
