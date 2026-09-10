import { createTwoFilesPatch } from "diff";
import type {ActionLog} from "./types";


export function formateDiff(filePath:string,before:string,after:string):string{
  const patch=createTwoFilesPatch(filePath,filePath,before,after,"","",{context:3});
  return patch;
}
 