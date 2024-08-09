import {
  EAS,
  SchemaEncoder,
  SchemaRegistry,
} from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

export const EASContractAddress = "0x4200000000000000000000000000000000000021"; // Base v1.0.1

const eas = new EAS(EASContractAddress);

const provider =
  ethers.getDefaultProvider("base") ||
  new ethers.JsonRpcProvider(process.env.RPC as string); // Providers like Infura/Alchemy is preferred
const signer = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider); // Private Key for the person who deployed the resolver contract

/**
 * Registers a new schema and returns the schema uid.
 *
 * @returns Promise<string>
 */
const registerSchema = async () => {
  const schemaRegistryContractAddress =
    "0x4200000000000000000000000000000000000020"; // Base v1.0.1
  const schemaRegistry = new SchemaRegistry(schemaRegistryContractAddress);

  schemaRegistry.connect(signer);

  const schema = "string[] values";
  const resolverAddress = "0xdeployed_resolver_address";
  const revocable = true;

  const tx = await schemaRegistry.register({
    schema,
    resolverAddress,
    revocable,
  });

  return await tx.wait();
};

/**
 * Returns the content of the schema registry.
 *
 * @returns Promise<SchemaRecord>
 */
const getSchemaInfo = async () => {
  const schemaRegistryContractAddress =
    "0x4200000000000000000000000000000000000020"; // Base v1.0.1
  const schemaRegistry = new SchemaRegistry(schemaRegistryContractAddress);

  schemaRegistry.connect(provider as unknown as any); // EAS has a type checking issue, this follows: https://docs.attest.org/docs/developer-tools/eas-sdk#using-the-eas-sdk
  const schemaUID = "0xschemaUID"; // Gotten after schema registration

  const schemaRecord = await schemaRegistry.getSchema({ uid: schemaUID });

  return schemaRecord;
};

/**
 * Creates a new attestation for a receipient address and returns the uid.
 *
 * @param recipient string
 * @param values string[]
 * @returns Promise<string>
 */
const createAttestation = async (recipient: string, values: string[]) => {
  eas.connect(signer);

  // Initialize SchemaEncoder with the schema string
  const schemaEncoder = new SchemaEncoder("string[] values");
  const encodedData = schemaEncoder.encodeData([
    { name: "values", value: values, type: "string[]" },
  ]);

  const schema = "0xschemaUID";

  const tx = await eas.attest({
    schema,
    data: {
      recipient,
      expirationTime: BigInt(0),
      revocable: true,
      data: encodedData,
    },
  });

  return await tx.wait();
};

/**
 * Returns the attestation data of the given uid.
 *
 * @param uid string
 * @returns Promise<string>
 */
const getAttestation = async (uid: string) => {
  eas.connect(provider as unknown as any); // EAS has a type checking issue, this follows: https://docs.attest.org/docs/developer-tools/eas-sdk#using-the-eas-sdk

  const attestation = await eas.getAttestation(uid);

  return attestation;
};

/**
 * Revokes the attestation of the given uid.
 * 
 * @param uid string
 */
const revokeAttestation = async (uid: string) => {
  eas.connect(signer);
  const schema = "0xschemaUID";

  const tx = await eas.revoke({
    schema,
    data: {
      uid,
    },
  });

  // Optional: Wait for transaction to be validated
  await tx.wait();
};
