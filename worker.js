const root = await navigator.storage.getDirectory();
const broadcast = new BroadcastChannel('opfs-events');

async function scan() {
    console.time('worker.scan')
    let entries = []

    for await (const [name, handle] of root.entries()) {
        const { size, lastModified } = await handle.getFile()

        entries.push({ name, size, lastModified })

    }

    // console.table(entries)
    console.timeEnd('worker.scan')

    self.postMessage({ type: 'scan', payload: entries })
}

async function remove(filename) {
    await root.removeEntry(filename);
    await invalidate();
}

async function add({ filename, contents }) {
    const handle = await root.getFileHandle(filename, {
        create: true,
    });

    // the reason we need a worker
    const access = await handle.createSyncAccessHandle({
        mode: "readwrite"
    })

    access.write(contents, { at: 0 });

    access.close()

    await invalidate()
}

async function openFile(filename) {
    const handle = await root.getFileHandle(filename);
    const file = await handle.getFile();
    const blobUrl = URL.createObjectURL(file); // Create an ObjectURL for the file

    console.log("PLX open", blobUrl)

    self.postMessage({
        type: 'open',
        payload: blobUrl
    });

    setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
    }, 5000);
}

self.addEventListener('message', ({ data }) => {
    console.log("worker", data)
    switch (data.type) {
        case "scan":
            scan();
            break;

        case "remove":
            remove(data.payload);
            break;

        case "add":
            add(data.payload);
            break;

        case "open":
            openFile(data.payload);
            break;
    }
});

async function invalidate() {
    broadcast.postMessage({ type: 'scan' });
    await scan();
}

broadcast.onmessage = () => {
    console.log("broadcast (invalidate)")
    scan()
}

// build initial list
scan()

self.postMessage({ type: 'ready' })
