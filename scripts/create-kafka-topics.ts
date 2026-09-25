import { kafka } from '../src/infrastructure/kafka/kafka-client.js';
import { env } from '../src/config/env.js';

async function createKafkaTopics(): Promise<void> {
  const admin = kafka.admin();

  await admin.connect();

  try {
    const existingTopics = await admin.listTopics();

    const topics = [
      env.kafka.eventsTopic,
      env.kafka.criticalTopic,
      env.kafka.dlqTopic,
    ];

    const topicsToCreate = topics
      .filter((topic) => !existingTopics.includes(topic))
      .map((topic) => ({
        topic,
        numPartitions: env.kafka.partitions,
        replicationFactor: env.kafka.replicationFactor,
      }));

    if (topicsToCreate.length === 0) {
      console.log('Kafka topics already exist.');
      return;
    }

    await admin.createTopics({
      topics: topicsToCreate,
      waitForLeaders: true,
    });

    console.log('Kafka topics created successfully:');
    for (const topic of topicsToCreate) {
      console.log(`- ${topic.topic}`);
    }
  } finally {
    await admin.disconnect();
  }
}

createKafkaTopics().catch((error: unknown) => {
  console.error('Failed to create Kafka topics:', error);
  process.exit(1);
});
