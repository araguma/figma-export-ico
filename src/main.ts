const dimensions = [16, 24, 32, 48, 64, 128, 256];
const headerSize = 6;
const directorySize = 16;
const headerDirectorySize = headerSize + directorySize * dimensions.length;

(async () => {
    figma.ui.onmessage = (message) => {
        switch(message.type) {
            case 'close':
                figma.closePlugin();
                break;
        }
    };
    
    if(figma.currentPage.selection.length === 0)
        return error('No items selected');
    
    figma.showUI(__html__, { visible: false });
    figma.ui.postMessage({
        type: 'export',
        data: await Promise.all(figma.currentPage.selection.map(async (node) => {
            return {
                name: node.name + '.ico',
                buffer: await convertICO(node),
            };
        })),
    });
})();

async function convertICO(node: SceneNode) {
    if(node.width !== node.height)
        return error('Width and height must be equal');

    const pngData = await Promise.all(dimensions.map(async (dimension) => {
        return await node.exportAsync({
            format: 'PNG',
            constraint: {
                type: 'SCALE',
                value: dimension / node.width,
            }
        });
    }));

    const icoData = new Uint8Array(headerDirectorySize + pngData.reduce((acc, cur) => {
        return acc + cur.length;
    }, 0));

    const icoDataView = new DataView(icoData.buffer);

    icoDataView.setUint16(0, 0, true);
    icoDataView.setUint16(2, 1, true);
    icoDataView.setUint16(4, dimensions.length, true);

    let offset = headerSize;
    let pngOffset = headerDirectorySize;
    for(let i = 0; i < dimensions.length; pngOffset += pngData[i].length, offset += directorySize, i ++) {
        icoDataView.setUint8(offset, dimensions[i] < 256 ? dimensions[i] : 0);    
        icoDataView.setUint8(offset + 1, dimensions[i] < 256 ? dimensions[i] : 0);
        icoDataView.setUint8(offset + 2, 0);
        icoDataView.setUint8(offset + 3, 0);
        icoDataView.setUint16(offset + 4, 1, true);
        icoDataView.setUint16(offset + 6, 0, true);
        icoDataView.setUint32(offset + 8, pngData[i].length, true);
        icoDataView.setUint32(offset + 12, pngOffset, true);
    }

    offset = headerDirectorySize;
    for(let i = 0; i < dimensions.length; i ++) {
        icoData.set(pngData[i], offset);
        offset += pngData[i].length;
    }

    return icoData;
}

function error(message: string): never {
    figma.closePlugin(message);
    throw new Error(message);
}