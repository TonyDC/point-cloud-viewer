# Docker command

`docker run -v $(pwd):/data pdal/pdal:1.5 pdal translate --writers.pcd.xyz=true /data/arnoso_edificio-Cloud_Decim_Octree_10.las /data/output.pcd`