<script lang="ts">
  import { onMount } from 'svelte';

  import './main.scss';

  let championsList = [];
  let itemsList = [];
  let canvas;
  let ctx;
  let championSearch = '';
  let itemSearch = '';
  let dialog;
  let selectedChampion;

  $: displayedChampions = championsList
    .filter(
      (champion) =>
        champion.id > 0 &&
        champion.name.toLowerCase().includes(championSearch.toLowerCase())
    )
    .sort((a, b) => {
      return a.name.localeCompare(b.name);
    });
  $: displayItems = itemsList.filter(
    (item) =>
      item.id > 0 && item.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  onMount(async () => {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');

    await Promise.all([
      fetch(
        'https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-summary.json'
      ).then((res) => res.json()),
      fetch(
        'https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/items.json'
      ).then((res) => res.json()),
    ])
      .then(([champions, items]) => {
        championsList = champions;
        itemsList = items;
      })
      .catch(() => {});
  });

  function squareImg(id) {
    return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;
  }
  function splash(id) {
    return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/uncentered/${id}/${id}000.jpg`;
  }
  function splashCentered(id) {
    return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/${id}/${id}000.jpg`;
  }
  function tile(id) {
    return `https://raw.communitydragon.org/pbe/plugins/rcp-be-lol-game-data/global/default/v1/champion-tiles/${id}/${id}000.jpg`;
  }
  function itemImg(itemPath) {
    const path = itemPath.replace(
      '/lol-game-data/assets/ASSETS/Items/Icons2D/',
      '/rcp-be-lol-game-data/global/default/assets/items/icons2d/'
    );
    console.log('xxxxx path', path);
    return `https://raw.communitydragon.org/pbe/plugins${path}`.toLowerCase();
  }

  function handleClick(id) {
    dialog.showModal();
    selectedChampion = id;
  }
  function handleClose() {
    dialog.close();
    selectedChampion = null;
  }

  function postMessage(type: string, payload: Object) {
    if (!type) return;
    parent.postMessage({ pluginMessage: { type, payload } }, '*');
  }

  const handleImgClick = async (e, id: number) => {
    const src = e.target.src;
    if (!src) return;

    const imgData = await decode(e.target.src, canvas, ctx);
    const newData = await encode(canvas, ctx, imgData);
    postMessage('imgClick', {
      data: newData,
      width: imgData.width,
      height: imgData.height,
    });
  };

  async function decode(url, canvas, ctx) {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject();
      img.crossOrigin = 'Anonymous';
      img.src = url;
    });
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    return imageData;
  }

  async function encode(canvas, ctx, imageData) {
    ctx.putImageData(imageData, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = () => reject(new Error('Could not read from blob'));
        reader.readAsArrayBuffer(blob);
      });
    });
  }

  const handleDrop = async (e) => {
    // Don't proceed if the item was dropped inside the plugin window.
    if (e.view.length === 0) return;
    const src = e.target.src;
    if (!src) return;

    const imgData = await decode(e.target.src, canvas, ctx);
    const newData = await encode(canvas, ctx, imgData);
    window.parent.postMessage(
      {
        pluginDrop: {
          clientX: e.clientX,
          clientY: e.clientY,
          items: [],
          dropMetadata: {
            data: newData,
            width: imgData.width,
            height: imgData.height,
          },
        },
      },
      '*'
    );
  };
</script>

<details>
  <summary>Champions</summary>
  <input
    type="text"
    bind:value={championSearch}
    placeholder="Search champions"
  />
  <div class="grid">
    {#each displayedChampions as champion}
      <img
        src={squareImg(champion.id)}
        width="120"
        height="120"
        loading="lazy"
        draggable="true"
        on:click={(e) => handleClick(champion.id)}
      />
    {/each}
  </div>
</details>

<details>
  <summary>Items</summary>
  <input type="text" bind:value={itemSearch} placeholder="Search items" />
  <div class="grid">
    {#each displayItems as item}
      <img
        src={itemImg(item.iconPath)}
        width="120"
        height="120"
        loading="lazy"
        draggable="true"
        on:dragend={handleDrop}
      />
    {/each}
  </div>
</details>

<dialog bind:this={dialog}>
  {selectedChampion}
  <div>
    <p>Square portrait</p>
    <img
      src={squareImg(selectedChampion)}
      width="80"
      height="80"
      draggable="true"
      on:dragend={handleDrop}
    />
  </div>
  <div>
    <p>Splash (default)</p>
    <img
      src={splash(selectedChampion)}
      width="176"
      height="99"
      draggable="true"
      on:dragend={handleDrop}
    />
  </div>
  <div>
    <p>Splash (centered)</p>
    <img
      src={splashCentered(selectedChampion)}
      width="176"
      height="99"
      draggable="true"
      on:dragend={handleDrop}
    />
  </div>
  <div>
    <p>Splash (tile)</p>
    <img
      src={tile(selectedChampion)}
      width="200"
      height="200"
      draggable="true"
      on:dragend={handleDrop}
    />
  </div>
  <form method="dialog"><button type="submit">Close</button></form>
</dialog>

<style lang="scss">
  :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
  }
  :global(body) {
    background: black;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
      Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
      'Segoe UI Symbol';
  }

  details {
    color: white;
    padding: 1rem;
  }
  summary {
    position: sticky;
    top: 0;
    padding: 0.5rem;
    background: black;
    font-weight: 700;
    text-transform: uppercase;
    cursor: pointer;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    grid-auto-rows: auto;
  }
</style>
