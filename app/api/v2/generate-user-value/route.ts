import User from "@/models/user";
import {NextRequest, NextResponse} from "next/server";
import {headers} from "next/headers";
import validateApiKey from "@/lib/validate-key";
import connectToDatabase from "@/lib/connect-to-db";
import {fetchCastsForUser} from "@/lib/fetch-user-casts";
import {generateValuesForUser} from "@/lib/generate-user-values-per-casts";
import {fetchUserTweets} from "@/lib/fetch-user-tweets";

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const apiKey = headers().get("x-api-key");
    const {isValid, message, status} = await validateApiKey(apiKey, "READ");
    if (!isValid) {
      return NextResponse.json({
        status: status,
        error: message,
      });
    }
    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get("email");
    const twitter = searchParams.get("twitter");
    const fid = searchParams.get("fid");
    const twitter_userId = searchParams.get("twitter_userId");

    if (!fid && !twitter) {
      return NextResponse.json({
        status: 400,
        error: "farcaster fid or Twitter handle is required",
      });
    }
    let user;
    user = await User.findOne({
      ...(email ? {email} : {}),
      ...(twitter ? {twitter} : {}),
      ...(fid ? {farcaster: fid} : {}),
    });

    if (!user) {
      user = await User.create({
        ...(email ? {email} : {}),
        ...(twitter ? {twitter} : {}),
        ...(fid ? {farcaster: fid} : {}),
      });
    }

    let generatedValues: string[] | undefined = undefined;
    if (twitter && twitter_userId) {
      const tweets = await fetchUserTweets(twitter_userId);
      if (tweets.length < 100) {
        return NextResponse.json({
          status: 400,
          error: "User has less than 100 tweets",
        });
      }
      generatedValues = await generateValuesForUser(tweets);
      if (generatedValues && generatedValues.length > 2) {
        user.aiGeneratedValues.twitter = Array.from(generatedValues);
      }
    } else if (fid) {
      const casts = await fetchCastsForUser(fid, 200);
      if (casts.length < 100) {
        return NextResponse.json({
          status: 400,
          error: "User has less than 100 casts",
        });
      }
      generatedValues = await generateValuesForUser(casts);
      if (generatedValues && generatedValues.length > 2) {
        user.aiGeneratedValues.warpcast = Array.from(generatedValues);
      }
    }

    await user.save();
    return NextResponse.json({
      status: 200,
      user,
    });
  } catch (error) {
    return NextResponse.json({
      error: error || "Internal Server Error",
      status: 500,
    });
  }
}
