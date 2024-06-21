import {NFT_CONTRACT_ABI, NFT_CONTRACT_ADDRESS} from "@/lib/constants";
import axios from "axios";
import {NextRequest, NextResponse} from "next/server";
import {createWalletClient, http} from "viem";
import {getAddressForFid} from "frames.js";
import {privateKeyToAccount} from "viem/accounts";
import {baseSepolia} from "viem/chains";

const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: http(),
  account: privateKeyToAccount(process.env.NEXT_PUBLIC_PK as `0x${string}`),
});

export async function GET(req: NextRequest, params: any) {
  const fid = params.params.fid;
  let values: string[] | undefined;
  let imageUrl = "";

  console.log("Fetching user values for", fid);
  try {
    console.log(`${process.env.NEXT_PUBLIC_HOST}/api/user?fid=${fid}`);
    const user = await fetch(
      `${process.env.NEXT_PUBLIC_HOST}/api/user?fid=${fid}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": `${process.env.NEXT_PUBLIC_NEXT_API_KEY}`,
        },
      }
    );

    const data = await user.json();
    console.log(data);
    values = data.user.aiGeneratedValues.warpcast;
    if (values) {
      imageUrl = `${
        process.env.NEXT_PUBLIC_HOST
      }/frames/ai/image?section=3&values=${values.join(",")}`;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
  return new NextResponse(
    `<!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="ValuesDAO" />
          <meta property="og:image" content="${imageUrl}" />
          <meta name="fc:frame" content="vNext" />
          <meta name="fc:frame:image" content="${imageUrl}" />
          <meta name="fc:frame:button:1" content="Mint" />,
        </head>
        <body></body>
      </html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}
export async function POST(req: NextRequest, params: any) {
  const imageUrl = `${process.env.NEXT_PUBLIC_HOST}/frames/ai/image?section=4`;
  const fid = params.params.fid;
  const batchUploadAndMint = async () => {
    const userResponse = await fetch(
      `${process.env.NEXT_PUBLIC_HOST}/api/user?fid=${fid}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": `${process.env.NEXT_PUBLIC_NEXT_API_KEY}`,
        },
      }
    );

    const userResponseData = await userResponse.json();
    console.log(userResponseData);
    const userValues = userResponseData.user.aiGeneratedValues.warpcast;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_HOST}/api/batch-upload-pinata`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": `${process.env.NEXT_PUBLIC_NEXT_API_KEY}`,
        },
        body: JSON.stringify({values: userValues}),
      }
    );
    const data = await response.json();
    //* change this fid
    const address = await getAddressForFid({
      fid: Number(fid),
    });
    console.log(data.cid, address);
    const hash = await walletClient.writeContract({
      abi: NFT_CONTRACT_ABI,
      address: NFT_CONTRACT_ADDRESS,

      functionName: "batchMint",
      args: [address, data.cid],
    });

    return hash;
  };

  console.log("Minting values for user", fid);
  const hash = await batchUploadAndMint();
  return new NextResponse(
    `<!DOCTYPE html>
      <html>
        <head>
          <meta property="og:title" content="ValuesDAO" />
          <meta property="og:image" content="${imageUrl}" />
          <meta name="fc:frame" content="vNext" />
          <meta name="fc:frame:image" content="${imageUrl}" />
         
          <meta name="fc:frame:button:1" content="View on Basescan" />
          <meta name="fc:frame:button:1:action" content="link" />
          <meta name="fc:frame:button:1:target" content="${`https://sepolia.basescan.org/tx/${hash}`}" />
          <meta name="fc:frame:button:2" content="Visit ValuesDAO" />
          <meta name="fc:frame:button:2:action" content="link" />
          <meta name="fc:frame:button:2:target" content="https://app.valuesdao.io" />

        </head>
        <body></body>
      </html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html",
      },
    }
  );
}
