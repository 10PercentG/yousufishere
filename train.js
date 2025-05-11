// train.js
require('dotenv').config();
const fs = require('fs');
const { CustomVisionTrainingClient } = require('@azure/ai-customvision-training');
const { AzureKeyCredential } = require('@azure/core-auth');

const trainer = new CustomVisionTrainingClient(
  process.env.TRAINING_ENDPOINT,
  new AzureKeyCredential(process.env.TRAINING_KEY)
);

(async () => {
  // 1) Create project
  const project = await trainer.createProject({ name: 'yousuf-detector' });

  // 2) Create tags
  const tagY = await trainer.createTag(project.id, { name: 'Yousuf' });
  const tagN = await trainer.createTag(project.id, { name: 'NotYousuf' });

  // 3) Upload images
  for (const f of fs.readdirSync('./yousuf-photos')) {
    const data = fs.readFileSync(`./yousuf-photos/${f}`);
    await trainer.createImagesFromData(project.id, { data, tagIds: [tagY.id] });
    console.log('Uploaded Yousuf:', f);
  }
  for (const f of fs.readdirSync('./other-photos')) {
    const data = fs.readFileSync(`./other-photos/${f}`);
    await trainer.createImagesFromData(project.id, { data, tagIds: [tagN.id] });
    console.log('Uploaded other:', f);
  }

  // 4) Train & publish
  const iteration = await trainer.trainProject(project.id);
  await trainer.updateIteration(project.id, iteration.id, { isDefault: true });
  console.log('✅ Training complete.');

  // Save project info
  fs.writeFileSync('cv-config.json', JSON.stringify({
    projectId: project.id,
    publishName: iteration.id
  }, null, 2));
})();
