import connectToDatabase from "@/lib/connect-to-db";
import FarcasterMeetup from "@/models/farcastermeetup";
import Farcon from "@/models/farcon";
import User, {IUser} from "@/models/user";
import {NextResponse} from "next/server";

export const GET = async (req: any) => {
  const searchParams = req.nextUrl.searchParams;

  const currentUserEmail = searchParams.get("email");
  const currentUserFid = searchParams.get("fid");
  const meetup = searchParams.get("fc_meetup");
  if (!currentUserFid && !currentUserEmail)
    return NextResponse.json({error: "Missing parameters", status: 400});

  try {
    await connectToDatabase();

    const user: IUser | null = await User.findOne({
      ...(currentUserEmail && {email: currentUserEmail}),
      ...(currentUserFid && {farcaster: currentUserFid}),
    });

    if (!user) {
      return NextResponse.json({error: "User not found", status: 404});
    }

    const sourceValues = user.mintedValues?.map((item) => item.value) ?? [];

    const farconPassholders = meetup
      ? await FarcasterMeetup.find({}, {__v: 0, _id: 0})
      : await Farcon.find({}, {__v: 0, _id: 0});

    const fids = farconPassholders.map((holder) => holder.fid);

    const users = await User.find({farcaster: {$in: fids}});

    const userMap = new Map(users.map((user) => [user.farcaster, user]));

    const alignmentOfHolder = farconPassholders
      .map((holder) => {
        const farconUser: IUser = userMap.get(Number(holder.fid) || "");
        if (holder.fid === currentUserFid) {
          return null;
        }
        if (!farconUser) {
          return {
            fid: holder.fid,
            alignment: 0,
            messages: "User not found",
            username: holder.username,
            image: holder.image,
            address: holder.address,
          };
        }

        const partnerValues =
          farconUser.mintedValues?.map((item) => item.value) ?? [];
        const intersection = partnerValues
          ? sourceValues.filter((value: any) => partnerValues.includes(value))
          : [];
        const union = Array.from(new Set([...sourceValues, ...partnerValues]));
        const percentageAlignment = (intersection.length / union.length) * 100;

        return {
          fid: holder.fid,
          alignment: percentageAlignment,
          username: holder.username,
          image: holder.image,
          address: holder.address,
        };
      })

      .filter((holder) => holder !== null);

    alignmentOfHolder.sort((a, b) => b!.alignment - a!.alignment);
    return NextResponse.json({holders: alignmentOfHolder, status: 200});
  } catch (error) {
    return NextResponse.json({
      error: error || "Internal Server Error",
      status: 500,
    });
  }
};
