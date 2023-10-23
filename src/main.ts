const dimensions = [16, 24, 32, 48, 64, 128, 256];
const headerSize = 6;
const directorySize = 16;
const headerDirectorySize = headerSize + directorySize * dimensions.length;

async function convertICO(node: SceneNode) {
    if(node.width !== node.height)
        return error('Width and height must be equal');

    const pngBuffers = await Promise.all(dimensions.map(async (dimension) => {
        return await node.exportAsync({
            format: 'PNG',
            constraint: {
                type: 'SCALE',
                value: dimension / node.width,
            }
        });
    }));

    const icoData = new Uint8Array(headerDirectorySize + pngBuffers.reduce((acc, cur) => {
        return acc + cur.length;
    }, 0));

    const icoBuffer = new DataView(icoData.buffer);

    icoBuffer.setUint16(0, 0, true);
    icoBuffer.setUint16(2, 1, true);
    icoBuffer.setUint16(4, dimensions.length, true);

    let offset = headerSize;
    let pngOffset = headerDirectorySize;
    for(let i = 0; i < dimensions.length; pngOffset += pngBuffers[i].length, offset += directorySize, i ++) {
        icoBuffer.setUint8(offset, dimensions[i] < 256 ? dimensions[i] : 0);    
        icoBuffer.setUint8(offset + 1, dimensions[i] < 256 ? dimensions[i] : 0);
        icoBuffer.setUint8(offset + 2, 0);
        icoBuffer.setUint8(offset + 3, 0);
        icoBuffer.setUint16(offset + 4, 1, true);
        icoBuffer.setUint16(offset + 6, 8, true);
        icoBuffer.setUint32(offset + 8, pngBuffers[i].length, true);
        icoBuffer.setUint32(offset + 12, pngOffset, true);
    }

    for(let i = 0; i < dimensions.length; i ++) {
        icoData.set(pngBuffers[i], headerDirectorySize + pngBuffers.slice(0, i).reduce((acc, cur) => {
            return acc + cur.length;
        }, 0));
    }

    return icoData;
}

async function main() {
    const selection = figma.currentPage.selection;

    figma.showUI(__html__, { visible: false });
    figma.ui.postMessage({
        type: 'export',
        data: await Promise.all(selection.map(async (node) => {
            return {
                name: node.name + '.ico',
                buffer: await convertICO(node),
            };
        })),
    });
}

function error(message: string): never {
    figma.closePlugin(message);
    throw new Error(message);
}

figma.ui.onmessage = (message) => {
    switch(message.type) {
        case 'close':
            figma.closePlugin();
            break;
    }
}

main();