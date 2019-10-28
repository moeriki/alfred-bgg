const fs = require('fs');
const path = require('path');

const alfy = require('alfy');
const got = require('got');
const { find, getOr } = require('lodash/fp');

/**
 * @typedef {object} BoardGameGeekItem
 * @param {number} objectid	eg. 174430
 * @param {string} subtype	eg. 'boardgame'
 * @param {number} primaryname	eg. 1
 * @param {number} nameid	eg. 972618
 * @param {number} yearpublished	eg. 2017
 * @param {string} ordtitle	eg. 'Gloomhaven'
 * @param {number} rep_imageid	eg. 2437871
 * @param {string} objecttype	eg. 'thing'
 * @param {string} name	eg. 'Gloomhaven'
 * @param {number} sortindex	eg. 1
 * @param {string} type	eg. 'things'
 * @param {number} id	eg. 174430
 * @param {string} href	eg. '/boardgame/174430/gloomhaven'
 */

const COUNT = 7;

const gameUrl = (locationPath) =>
  `https://www.boardgamegeek.com${locationPath}`;

const searchJsonUrl = (query) =>
  `https://www.boardgamegeek.com/search/boardgame?q=${encodeURIComponent(
    query,
  )}&showcount=${COUNT}`;

const searchHtmlUrl = (query) =>
  `https://www.boardgamegeek.com/geeksearch.php?action=search&objecttype=boardgame&q=${encodeURIComponent(
    query,
  )}`;

const searchImagesUrl = (objectid) =>
  `https://api.geekdo.com/api/images?galleries%5B%5D=game&nosession=1&objectid=${objectid}&objecttype=thing&showcount=99&size=crop100&sort=hot`;

async function findImageFilepath({ objectid, rep_imageid }) {
  const cacheKey = String(rep_imageid);
  const cachedImageImageFilepath = await alfy.cache.get(cacheKey);
  if (cachedImageImageFilepath) {
    return cachedImageImageFilepath;
  }
  const images = getOr(
    [],
    'images',
    await alfy.fetch(searchImagesUrl(objectid)),
  );
  const image = find({ imageid: String(rep_imageid) }, images);
  if (!image) {
    return undefined;
  }
  const imageCacheFilepath = path.join(__dirname, `.cache/${rep_imageid}.png`);
  const writeStream = got
    .stream(image.imageurl)
    .pipe(fs.createWriteStream(imageCacheFilepath));
  return new Promise((resolve, reject) => {
    writeStream.on('error', reject);
    writeStream.on('finish', async () => {
      await alfy.cache.set(cacheKey, imageCacheFilepath);
      resolve(imageCacheFilepath);
    });
  });
}

(async () => {
  const data = await alfy.fetch(searchJsonUrl(alfy.input));
  alfy.output(
    await Promise.all(
      data.items
        .map(async ({ href, name, objectid, rep_imageid, yearpublished }) => {
          const imageFilepath = await findImageFilepath({
            objectid,
            rep_imageid,
          });
          return {
            arg: gameUrl(href),
            icon: imageFilepath ? { path: imageFilepath } : undefined,
            subtitle: `${yearpublished}`,
            title: `${name}`,
          };
        })
        .concat([
          {
            arg: searchHtmlUrl(alfy.input),
            subtitle: 'Search boardgamegeek.com',
            title: `Search on bgg: ${alfy.input}`,
          },
        ]),
    ),
  );
})();
