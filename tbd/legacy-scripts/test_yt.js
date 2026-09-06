import ytSearch from 'youtube-search-api';

async function main() {
  const res = await ytSearch.GetListByKeyword('lkg transport name for kids', false, 1);
  console.log(res.items[0].id);
}
main();
