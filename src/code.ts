figma.showUI(__html__, { width: 400, height: 600 });

figma.ui.onmessage = (msg) => {
  switch(msg.type) {
    case 'imgClick':
      const { payload } = msg;
      const { data, width, height } = payload;  
      if (!data) break;
      let rectangle = figma.createRectangle();
      rectangle.resize(width, height);      
      rectangle.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: figma.createImage(data).hash }];
      // figma.viewport.scrollAndZoomIntoView([rectangle]);
      break;
    default:
      break;
  }

  
  if (msg.type === "createShape") {
    let rectangle = figma.createRectangle();
    rectangle.resize(400, 400);
    rectangle.fills = [{ type: "SOLID", color: { r: 0, g: 0, b: 1 } }];
    figma.viewport.scrollAndZoomIntoView([rectangle]);
    figma.closePlugin();
  }

  // figma.closePlugin();
};

figma.on('drop', (event) => {
  const { dropMetadata, node } = event
  const { width, height, data } = dropMetadata;

  console.log('drop', event);

  let newNode = figma.createRectangle();
  newNode.resize(width, height);  
  newNode.fills = [{ type: "IMAGE", scaleMode: "FILL", imageHash: figma.createImage(data).hash }];

  if (node.appendChild) {
    node.appendChild(newNode);
  }

  // newNode.x = event.x;
  // newNode.y = event.y;
  newNode.x = event.absoluteX;
  newNode.y = event.absoluteY;

  console.log('newNode', newNode)

  figma.currentPage.selection = [newNode]
});