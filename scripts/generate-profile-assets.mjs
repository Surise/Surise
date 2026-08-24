import { mkdir, writeFile } from 'node:fs/promises';

const username = process.env.GITHUB_USERNAME || 'Surise';
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`);
  return response.json();
}

const profile = await github(`/users/${username}`);
const repos = await github(`/users/${username}/repos?per_page=100&sort=updated`);
const languageTotals = new Map();

for (let index = 0; index < repos.length; index += 6) {
  const batch = repos.slice(index, index + 6);
  const languages = await Promise.all(
    batch.map((repo) => github(`/repos/${username}/${repo.name}/languages`)),
  );
  languages.forEach((languageSet) => {
    Object.entries(languageSet).forEach(([language, bytes]) => {
      languageTotals.set(language, (languageTotals.get(language) || 0) + bytes);
    });
  });
}

const languages = [...languageTotals.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6);
const totalBytes = languages.reduce((sum, [, bytes]) => sum + bytes, 0) || 1;
const stars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
const forks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);

const escape = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');
const shortNumber = (value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value;
const palette = ['#7aa2f7', '#bb9af7', '#7dcfff', '#9ece6a', '#e0af68', '#f7768e'];

const statsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="190" viewBox="0 0 495 190" role="img" aria-labelledby="title desc">
  <title id="title">${escape(username)} GitHub statistics</title>
  <desc id="desc">Repositories, stars, forks and followers</desc>
  <rect width="495" height="190" rx="12" fill="#24283b"/>
  <text x="28" y="36" fill="#c0caf5" font-family="Arial,sans-serif" font-size="18" font-weight="700">GitHub statistics</text>
  <text x="28" y="58" fill="#565f89" font-family="Arial,sans-serif" font-size="12">${escape(username)} · updated by GitHub Actions</text>
  ${[
    ['Repositories', profile.public_repos],
    ['Followers', profile.followers],
    ['Stars', stars],
    ['Forks', forks],
  ].map(([label, value], index) => {
    const x = 28 + (index % 2) * 225;
    const y = 98 + Math.floor(index / 2) * 55;
    return `<text x="${x}" y="${y}" fill="#7aa2f7" font-family="Arial,sans-serif" font-size="24" font-weight="700">${escape(shortNumber(value))}</text><text x="${x}" y="${y + 19}" fill="#a9b1d6" font-family="Arial,sans-serif" font-size="12">${label}</text>`;
  }).join('')}
</svg>`;

const rows = languages.length ? languages.map(([language, bytes], index) => {
  const percent = (bytes / totalBytes) * 100;
  const y = 58 + index * 21;
  return `<text x="28" y="${y}" fill="#c0caf5" font-family="Arial,sans-serif" font-size="12">${escape(language)}</text><rect x="130" y="${y - 11}" width="310" height="9" rx="4" fill="#414868"/><rect x="130" y="${y - 11}" width="${Math.max(percent * 3.1, 3)}" height="9" rx="4" fill="${palette[index]}"/><text x="450" y="${y}" text-anchor="end" fill="#a9b1d6" font-family="Arial,sans-serif" font-size="11">${percent.toFixed(1)}%</text>`;
}).join('') : '<text x="28" y="65" fill="#a9b1d6" font-family="Arial,sans-serif" font-size="12">No language data yet</text>';

const languagesSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="190" viewBox="0 0 495 190" role="img" aria-labelledby="title desc">
  <title id="title">${escape(username)} repository languages</title>
  <desc id="desc">Top languages across public repositories</desc>
  <rect width="495" height="190" rx="12" fill="#24283b"/>
  <text x="28" y="36" fill="#c0caf5" font-family="Arial,sans-serif" font-size="18" font-weight="700">Repository languages</text>
  ${rows}
</svg>`;

await mkdir('output', { recursive: true });
await writeFile('output/stats.svg', statsSvg);
await writeFile('output/languages.svg', languagesSvg);
