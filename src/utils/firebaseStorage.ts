import { getStorage } from "firebase/storage";
import firebaseApp from "./firebase";

const firebaseStorage = getStorage(firebaseApp);
export default firebaseStorage;
