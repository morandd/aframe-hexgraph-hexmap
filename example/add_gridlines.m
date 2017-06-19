% MATLAB script add gridlines to an image. I pixeled it by reducing the
% image to 10% of its original size then scale up 10x larger using Nearest
% Neigbor interpolation. Then ran this script to add the gridlines.

fn ='asia_820_pixelized.jpg';

a=imread(fn);

 %Pixelize

for r=1:10:size(a,1)
    for c=1:10:size(a,2)
        rows = r:(r+9);
        cols=c:(c+9);
        avg = sum(sum(a(rows, cols, 1))) / 100;
        a(rows,cols,:)=ceil(avg);
    end
end

% Add grid afterward
for r=1:10:size(a,1)
    a(r,:,:)=200;
    for c=1:10:size(a,2)
        a(:,c,:)=200;
    end
    a(r,:,:)=200;
end


imagesc(a);
fn = [fn(1:end-4) '_gridded.jpg'];
imwrite(a,fn);

    