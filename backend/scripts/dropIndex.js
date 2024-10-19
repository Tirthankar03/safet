import { RegionMap } from "../utils/clustering.js";


const drop = async () => {
    try {
        await RegionMap.collection.dropIndexes();
        console.log('dropedd successfully!')
    } catch (error) {
        console.error('error occured while dropping', error)
    }
}

drop()